#!/usr/bin/env bun
/// <reference types="bun-types" />

import { MCPComplianceValidator } from '../compliance/validator';



interface ComplianceReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  warnings: number;
  results: Array<{
    testName: string;
    passed: boolean;
    errors: string[];
    warnings: string[];
  }>;
  summary: string;
}

async function runComplianceCheck(): Promise<void> {
  console.log('🔍 Starting MCP Protocol Compliance Check...\n');

  const validator = new MCPComplianceValidator();
  
  // Give time for protobuf definitions to load
  await new Promise(resolve => setTimeout(resolve, 200));

  try {
    // Run comprehensive compliance tests
    const results = validator.runComplianceTests();
    
    // Generate compliance report
    const report: ComplianceReport = {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passedTests: results.filter(r => r.passed).length,
      failedTests: results.filter(r => !r.passed).length,
      warnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
      results: results.map(r => ({
        testName: r.details?.expectedSchema && 
                 typeof r.details.expectedSchema === 'object' && 
                 'testName' in r.details.expectedSchema 
          ? r.details.expectedSchema.testName as string 
          : 'Unknown Test',
        passed: r.passed,
        errors: r.errors,
        warnings: r.warnings
      })),
      summary: ''
    };

    // Generate summary
    const passRate = ((report.passedTests / report.totalTests) * 100).toFixed(1);
    report.summary = `Compliance: ${report.passedTests}/${report.totalTests} tests passed (${passRate}%)`;

    // Print results
    console.log('📊 Compliance Test Results:');
    console.log('=' .repeat(50));
    
    for (const result of report.results) {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.testName}`);
      
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
      
      if (result.warnings.length > 0) {
        console.log(`   Warnings: ${result.warnings.join(', ')}`);
      }
    }

    console.log('\n' + '=' .repeat(50));
    console.log(`📈 ${report.summary}`);
    console.log(`⚠️  ${report.warnings} warnings found`);
    
    if (report.failedTests > 0) {
      console.log(`❌ ${report.failedTests} tests failed`);
    }

    // Test specific protocol compliance scenarios
    console.log('\n🔬 Testing Specific Protocol Scenarios...');
    
    // Test valid initialize request
    const validInitRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {
          name: 'compliance-test',
          version: '1.0.0'
        }
      }
    };

    const initValidation = validator.validateRequest(validInitRequest);
    console.log(`✅ Initialize Request: ${initValidation.passed ? 'PASS' : 'FAIL'}`);
    if (!initValidation.passed) {
      console.log(`   Errors: ${initValidation.errors.join(', ')}`);
    }

    // Test valid tools/call request
    const validToolCallRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'test_tool',
        arguments: { param: 'value' }
      }
    };

    const toolCallValidation = validator.validateRequest(validToolCallRequest);
    console.log(`✅ Tools/Call Request: ${toolCallValidation.passed ? 'PASS' : 'FAIL'}`);
    if (!toolCallValidation.passed) {
      console.log(`   Errors: ${toolCallValidation.errors.join(', ')}`);
    }

    // Test valid response
    const validResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        serverInfo: {
          name: 'mcp-kit',
          version: '0.1.0'
        }
      }
    };

    const responseValidation = validator.validateResponse(validResponse);
    console.log(`✅ Response Validation: ${responseValidation.passed ? 'PASS' : 'FAIL'}`);
    if (!responseValidation.passed) {
      console.log(`   Errors: ${responseValidation.errors.join(', ')}`);
    }

    // Test error response
    const errorResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32602,
        message: 'Invalid params'
      }
    };

    const errorValidation = validator.validateResponse(errorResponse);
    console.log(`✅ Error Response: ${errorValidation.passed ? 'PASS' : 'FAIL'}`);
    if (!errorValidation.passed) {
      console.log(`   Errors: ${errorValidation.errors.join(', ')}`);
    }

    // Save report to file
    const reportPath = 'compliance-report.json';
    await Bun.write(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Compliance report saved to: ${reportPath}`);

    // Exit with appropriate code
    if (report.failedTests > 0) {
      console.log('\n❌ Compliance check failed!');
      process.exit(1);
    } else {
      console.log('\n✅ All compliance tests passed!');
      process.exit(0);
    }

  } catch (error) {
    console.error('💥 Compliance check failed with error:', error);
    process.exit(1);
  }
}

// Run the compliance check
if (import.meta.main) {
  runComplianceCheck().catch(error => {
    console.error('💥 Unhandled error in compliance check:', error);
    process.exit(1);
  });
}
