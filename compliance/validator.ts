import * as protobuf from 'protobufjs';

export interface ComplianceValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  details?: {
    actualMessage: unknown;
    expectedSchema: unknown;
    validationErrors: string[];
  };
}

export interface ComplianceTest {
  name: string;
  description: string;
  validate: (message: unknown) => ComplianceValidationResult;
}

export class MCPComplianceValidator {
  private root: protobuf.Root;
  private messageTypes: Map<string, protobuf.Type> = new Map();

  constructor() {
    this.root = new protobuf.Root();
    void this.loadProtobufDefinitions();
  }

  private async loadProtobufDefinitions(): Promise<void> {
    try {
      // Load the protobuf definitions - handle both Bun and Node.js environments
      let protoContent: string;
      
      if (typeof Bun !== 'undefined') {
        // Bun environment
        protoContent = await Bun.file('compliance/protobuf/mcp.proto').text();
      } else {
        // Node.js environment (for tests)
        const fs = await import('fs/promises');
        const path = await import('path');
        const protoPath = path.join(process.cwd(), 'compliance/protobuf/mcp.proto');
        protoContent = await fs.readFile(protoPath, 'utf-8');
      }
      
      this.root = protobuf.parse(protoContent).root;
      
      // Cache message types for faster validation
      this.messageTypes.set('MCPRequest', this.root.lookupType('mcp.MCPRequest'));
      this.messageTypes.set('MCPResponse', this.root.lookupType('mcp.MCPResponse'));
      this.messageTypes.set('InitializeParams', this.root.lookupType('mcp.InitializeParams'));
      this.messageTypes.set('InitializeResult', this.root.lookupType('mcp.InitializeResult'));
      this.messageTypes.set('ToolsListResult', this.root.lookupType('mcp.ToolsListResult'));
      this.messageTypes.set('ToolCallResult', this.root.lookupType('mcp.ToolCallResult'));
      this.messageTypes.set('PromptsListResult', this.root.lookupType('mcp.PromptsListResult'));
      this.messageTypes.set('PromptGetResult', this.root.lookupType('mcp.PromptGetResult'));
      this.messageTypes.set('ResourcesListResult', this.root.lookupType('mcp.ResourcesListResult'));
      this.messageTypes.set('ResourceReadResult', this.root.lookupType('mcp.ResourceReadResult'));
      this.messageTypes.set('ResourceTemplatesListResult', this.root.lookupType('mcp.ResourceTemplatesListResult'));
      this.messageTypes.set('NotificationAckResult', this.root.lookupType('mcp.NotificationAckResult'));
      this.messageTypes.set('PingResult', this.root.lookupType('mcp.PingResult'));
    } catch (error) {
      console.error('Failed to load protobuf definitions:', error);
      throw new Error('Failed to initialize MCP compliance validator');
    }
  }

  /**
   * Validate a JSON-RPC request against MCP protocol requirements
   */
  validateRequest(request: unknown): ComplianceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic JSON-RPC 2.0 validation
      if (!request || typeof request !== 'object') {
        errors.push('Request must be a valid JSON object');
        return { passed: false, errors, warnings };
      }

      const req = request as Record<string, unknown>;

      // Check jsonrpc version
      if (req.jsonrpc !== '2.0') {
        errors.push('jsonrpc must be "2.0"');
      }

      // Check id field
      if (req.id === undefined || req.id === null) {
        errors.push('id field is required');
      } else if (typeof req.id !== 'string' && typeof req.id !== 'number') {
        errors.push('id must be string or number');
      }

      // Check method field
      if (!req.method || typeof req.method !== 'string') {
        errors.push('method field is required and must be a string');
      } else {
        // Validate method name against MCP specification
        const validMethods = [
          'initialize',
          'notifications/initialized',
          'tools/list',
          'tools/call',
          'prompts/list',
          'prompts/get',
          'resources/list',
          'resources/read',
          'resources/templates/list',
          'ping'
        ];
        
        if (typeof req.method === 'string' && !validMethods.includes(req.method)) {
          warnings.push(`Method "${req.method}" is not a standard MCP method`);
        }
      }

      // Validate params based on method
      if (req.params !== undefined) {
        const method = typeof req.method === 'string' ? req.method : '';
        const paramsValidation = this.validateMethodParams(method, req.params);
        errors.push(...paramsValidation.errors);
        warnings.push(...paramsValidation.warnings);
      }

      return {
        passed: errors.length === 0,
        errors,
        warnings,
        details: {
          actualMessage: request,
          expectedSchema: this.getExpectedSchema('MCPRequest'),
          validationErrors: errors
        }
      };
    } catch (error) {
      return {
        passed: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      };
    }
  }

  /**
   * Validate a JSON-RPC response against MCP protocol requirements
   */
  validateResponse(response: unknown): ComplianceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic JSON-RPC 2.0 validation
      if (!response || typeof response !== 'object') {
        errors.push('Response must be a valid JSON object');
        return { passed: false, errors, warnings };
      }

      const resp = response as Record<string, unknown>;

      // Check jsonrpc version
      if (resp.jsonrpc !== '2.0') {
        errors.push('jsonrpc must be "2.0"');
      }

      // Check id field
      if (resp.id === undefined || resp.id === null) {
        errors.push('id field is required');
      } else if (typeof resp.id !== 'string' && typeof resp.id !== 'number') {
        errors.push('id must be string or number');
      }

      // Check result/error fields
      if (resp.result === undefined && resp.error === undefined) {
        errors.push('Either result or error field must be present');
      } else if (resp.result !== undefined && resp.error !== undefined) {
        errors.push('Cannot have both result and error fields');
      }

      // Validate error structure if present
      if (resp.error !== undefined) {
        const errorValidation = this.validateError(resp.error);
        errors.push(...errorValidation.errors);
        warnings.push(...errorValidation.warnings);
      }

      return {
        passed: errors.length === 0,
        errors,
        warnings,
        details: {
          actualMessage: response,
          expectedSchema: this.getExpectedSchema('MCPResponse'),
          validationErrors: errors
        }
      };
    } catch (error) {
      return {
        passed: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      };
    }
  }

  /**
   * Validate method-specific parameters
   */
  private validateMethodParams(method: string, params: unknown): ComplianceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      switch (method) {
        case 'initialize':
          return this.validateInitializeParams(params);
        case 'tools/call':
          return this.validateToolsCallParams(params);
        case 'prompts/get':
          return this.validatePromptGetParams(params);
        case 'resources/read':
          return this.validateResourceReadParams(params);
        default:
          // For other methods, params should be an object or undefined
          if (params !== undefined && (typeof params !== 'object' || params === null)) {
            errors.push(`params for method "${method}" must be an object or undefined`);
          }
      }
    } catch (error) {
      errors.push(`Parameter validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { passed: errors.length === 0, errors, warnings };
  }

  /**
   * Validate initialize method parameters
   */
  private validateInitializeParams(params: unknown): ComplianceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params || typeof params !== 'object') {
      errors.push('initialize params must be an object');
      return { passed: false, errors, warnings };
    }

    const initParams = params as Record<string, unknown>;

    // Check protocolVersion
    if (!initParams.protocolVersion || typeof initParams.protocolVersion !== 'string') {
      errors.push('protocolVersion is required and must be a string');
    }

    // Check capabilities
    if (initParams.capabilities !== undefined) {
      if (typeof initParams.capabilities !== 'object' || initParams.capabilities === null) {
        errors.push('capabilities must be an object');
      }
    }

    // Check clientInfo
    if (initParams.clientInfo !== undefined) {
      if (typeof initParams.clientInfo !== 'object' || initParams.clientInfo === null) {
        errors.push('clientInfo must be an object');
      } else {
        const clientInfo = initParams.clientInfo as Record<string, unknown>;
        if (!clientInfo.name || typeof clientInfo.name !== 'string') {
          errors.push('clientInfo.name is required and must be a string');
        }
        if (!clientInfo.version || typeof clientInfo.version !== 'string') {
          errors.push('clientInfo.version is required and must be a string');
        }
      }
    }

    return { passed: errors.length === 0, errors, warnings };
  }

  /**
   * Validate tools/call method parameters
   */
  private validateToolsCallParams(params: unknown): ComplianceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params || typeof params !== 'object') {
      errors.push('tools/call params must be an object');
      return { passed: false, errors, warnings };
    }

    const callParams = params as Record<string, unknown>;

    // Check name
    if (!callParams.name || typeof callParams.name !== 'string') {
      errors.push('name is required and must be a string');
    }

    // Check arguments
    if (callParams.arguments !== undefined) {
      if (typeof callParams.arguments !== 'object' || callParams.arguments === null) {
        errors.push('arguments must be an object');
      }
    }

    return { passed: errors.length === 0, errors, warnings };
  }

  /**
   * Validate prompts/get method parameters
   */
  private validatePromptGetParams(params: unknown): ComplianceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params || typeof params !== 'object') {
      errors.push('prompts/get params must be an object');
      return { passed: false, errors, warnings };
    }

    const promptParams = params as Record<string, unknown>;

    // Check name
    if (!promptParams.name || typeof promptParams.name !== 'string') {
      errors.push('name is required and must be a string');
    }

    // Check arguments
    if (promptParams.arguments !== undefined) {
      if (typeof promptParams.arguments !== 'object' || promptParams.arguments === null) {
        errors.push('arguments must be an object');
      }
    }

    return { passed: errors.length === 0, errors, warnings };
  }

  /**
   * Validate resources/read method parameters
   */
  private validateResourceReadParams(params: unknown): ComplianceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params || typeof params !== 'object') {
      errors.push('resources/read params must be an object');
      return { passed: false, errors, warnings };
    }

    const resourceParams = params as Record<string, unknown>;

    // Check uri
    if (!resourceParams.uri || typeof resourceParams.uri !== 'string') {
      errors.push('uri is required and must be a string');
    } else {
      // Validate URI format
      const uri = resourceParams.uri;
      if (typeof uri === 'string' && !uri.includes('://')) {
        errors.push('uri must be a valid URI with scheme');
      }
    }

    return { passed: errors.length === 0, errors, warnings };
  }

  /**
   * Validate error structure
   */
  private validateError(error: unknown): ComplianceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!error || typeof error !== 'object') {
      errors.push('error must be an object');
      return { passed: false, errors, warnings };
    }

    const err = error as Record<string, unknown>;

    // Check code
    if (typeof err.code !== 'number') {
      errors.push('error.code must be a number');
    }

    // Check message
    if (!err.message || typeof err.message !== 'string') {
      errors.push('error.message is required and must be a string');
    }

    // Check data (optional)
    if (err.data !== undefined) {
      if (typeof err.data !== 'object' || err.data === null) {
        errors.push('error.data must be an object if present');
      }
    }

    return { passed: errors.length === 0, errors, warnings };
  }

  /**
   * Get expected schema for a message type
   */
  private getExpectedSchema(messageType: string): unknown {
    const type = this.messageTypes.get(messageType);
    if (!type) {
      return { error: `Unknown message type: ${messageType}` };
    }

    try {
      // Return a simplified schema representation
      return {
        type: 'object',
        properties: type.fields,
        required: Object.keys(type.fields).filter(field => !type.fields[field].optional)
      };
    } catch (error) {
      return { error: `Failed to generate schema for ${messageType}` };
    }
  }

  /**
   * Run a comprehensive compliance test suite
   */
  runComplianceTests(): ComplianceValidationResult[] {
    const tests: ComplianceTest[] = [
      {
        name: 'JSON-RPC 2.0 Basic Structure',
        description: 'Validate basic JSON-RPC 2.0 message structure',
        validate: (message) => {
          if (!message || typeof message !== 'object') {
            return { passed: false, errors: ['Message must be an object'], warnings: [] };
          }
          
          const msg = message as Record<string, unknown>;
          const errors: string[] = [];
          
          if (msg.jsonrpc !== '2.0') {
            errors.push('jsonrpc must be "2.0"');
          }
          
          if (msg.id === undefined) {
            errors.push('id field is required');
          }
          
          return { passed: errors.length === 0, errors, warnings: [] };
        }
      },
      {
        name: 'MCP Method Validation',
        description: 'Validate MCP method names',
        validate: (message) => {
          if (!message || typeof message !== 'object') {
            return { passed: false, errors: ['Message must be an object'], warnings: [] };
          }
          
          const msg = message as Record<string, unknown>;
          const validMethods = [
            'initialize', 'notifications/initialized', 'tools/list', 'tools/call',
            'prompts/list', 'prompts/get', 'resources/list', 'resources/read',
            'resources/templates/list', 'ping'
          ];
          
          if (msg.method && typeof msg.method === 'string' && !validMethods.includes(msg.method)) {
            return { 
              passed: false, 
              errors: [`Invalid MCP method: ${msg.method}`], 
              warnings: [] 
            };
          }
          
          return { passed: true, errors: [], warnings: [] };
        }
      }
    ];

    const results: ComplianceValidationResult[] = [];
    
    for (const test of tests) {
      try {
        // Use a valid JSON-RPC 2.0 message for testing
        const testMessage = {
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
        
        const result = test.validate(testMessage);
        results.push({
          ...result,
          details: {
            actualMessage: testMessage,
            expectedSchema: { testName: test.name },
            validationErrors: result.errors
          }
        });
      } catch (error) {
        results.push({
          passed: false,
          errors: [`Test "${test.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          warnings: []
        });
      }
    }

    return results;
  }
}
