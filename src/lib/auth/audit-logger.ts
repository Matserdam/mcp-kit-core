import type { MCPRequestWithHeaders } from '../../types/auth.d.ts';
import { debugLoggers } from '../debug';

/**
 * Auth audit log event types
 */
export type MCPAuthAuditEvent = 
  | 'token_validation' 
  | 'audience_mismatch' 
  | 'scope_insufficient' 
  | 'token_expired' 
  | 'auth_success'
  | 'auth_error'
  | 'security_issue';

/**
 * Audit log entry structure
 */
export interface MCPAuthAuditEntry {
  timestamp: string;
  event: MCPAuthAuditEvent;
  details: Record<string, unknown>;
  requestInfo?: {
    method: string;
    resourceUri: string;
    userAgent?: string;
    ipAddress?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  correlationId?: string;
}

/**
 * Audit log configuration options
 */
export interface MCPAuthAuditConfig {
  /** Enable/disable audit logging */
  enabled?: boolean;
  
  /** Minimum severity level to log */
  minSeverity?: 'low' | 'medium' | 'high' | 'critical';
  
  /** Custom logger function */
  logger?: (entry: MCPAuthAuditEntry) => void | Promise<void>;
  
  /** Include request details in logs */
  includeRequestDetails?: boolean;
  
  /** Include sensitive information (use with caution) */
  includeSensitiveData?: boolean;
  
  /** Custom correlation ID generator */
  correlationIdGenerator?: () => string;
  
  /** Event filtering */
  eventFilter?: (event: MCPAuthAuditEvent) => boolean;
}

/**
 * Enhanced audit logger for auth events
 */
export class MCPAuthAuditLogger {
  private config: Required<MCPAuthAuditConfig>;
  private correlationIdGenerator: () => string;

  constructor(config: MCPAuthAuditConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      minSeverity: config.minSeverity ?? 'low',
      logger: config.logger ?? this.defaultLogger.bind(this),
      includeRequestDetails: config.includeRequestDetails ?? true,
      includeSensitiveData: config.includeSensitiveData ?? false,
      correlationIdGenerator: config.correlationIdGenerator ?? this.defaultCorrelationIdGenerator.bind(this),
      eventFilter: config.eventFilter ?? (() => true)
    };
    
    this.correlationIdGenerator = this.config.correlationIdGenerator;
  }

  /**
   * Log an auth audit event
   */
  async log(
    event: MCPAuthAuditEvent,
    details: Record<string, unknown>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    request?: MCPRequestWithHeaders,
    correlationId?: string
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    if (!this.shouldLog(event, severity)) {
      return;
    }

    const entry: MCPAuthAuditEntry = {
      timestamp: new Date().toISOString(),
      event,
      details: this.sanitizeDetails(details),
      severity,
      correlationId: correlationId || this.correlationIdGenerator()
    };

    if (this.config.includeRequestDetails && request) {
      entry.requestInfo = this.extractRequestInfo(request);
    }

    try {
      await this.config.logger(entry);
    } catch (error) {
      // Fallback to debug logger if custom logger fails
      debugLoggers.audit('Failed to log audit entry:', error);
      this.defaultLogger(entry);
    }
  }

  /**
   * Check if event should be logged based on configuration
   */
  private shouldLog(event: MCPAuthAuditEvent, severity: 'low' | 'medium' | 'high' | 'critical'): boolean {
    if (!this.config.eventFilter(event)) {
      return false;
    }

    const severityLevels = { low: 0, medium: 1, high: 2, critical: 3 };
    return severityLevels[severity] >= severityLevels[this.config.minSeverity];
  }

  /**
   * Sanitize details to remove sensitive information
   */
  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    if (this.config.includeSensitiveData) {
      return details;
    }

    const sanitized = { ...details };
    
    // Remove sensitive fields
    const sensitiveFields = ['token', 'password', 'secret', 'key', 'authorization'];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Extract request information for logging
   */
  private extractRequestInfo(request: MCPRequestWithHeaders): MCPAuthAuditEntry['requestInfo'] {
    const headers = request.headers || {};
    
    return {
      method: request.method,
      resourceUri: String((request.params as Record<string, unknown>)?.uri || 
                   (request.params as Record<string, unknown>)?.name || 
                   'unknown'),
      userAgent: headers['user-agent'] || headers['User-Agent'],
      ipAddress: headers['x-forwarded-for'] || headers['x-real-ip'] || headers['cf-connecting-ip']
    };
  }

  /**
   * Default logger implementation
   */
  private defaultLogger(entry: MCPAuthAuditEntry): void {
          debugLoggers.audit(JSON.stringify(entry, null, 2));
  }

  /**
   * Default correlation ID generator
   */
  private defaultCorrelationIdGenerator(): string {
    return `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a child logger with additional context
   */
  createChildLogger(additionalConfig: Partial<MCPAuthAuditConfig>): MCPAuthAuditLogger {
    return new MCPAuthAuditLogger({
      ...this.config,
      ...additionalConfig
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<MCPAuthAuditConfig> {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MCPAuthAuditConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Global audit logger instance
 */
export const globalAuthAuditLogger = new MCPAuthAuditLogger();

/**
 * Convenience function for backward compatibility
 */
export function createAuthAuditLog(
  event: MCPAuthAuditEvent,
  details: Record<string, unknown>,
  request?: MCPRequestWithHeaders
): void {
  // Determine severity based on event type
  const severityMap: Record<MCPAuthAuditEvent, 'low' | 'medium' | 'high' | 'critical'> = {
    'auth_success': 'low',
    'token_validation': 'medium',
    'scope_insufficient': 'medium',
    'token_expired': 'high',
    'audience_mismatch': 'critical',
    'auth_error': 'high',
    'security_issue': 'critical'
  };

  const severity = severityMap[event] || 'medium';
  
  // Use global logger
  globalAuthAuditLogger.log(event, details, severity, request).catch(error => {
    debugLoggers.audit('Failed to log audit entry:', error);
  });
}

/**
 * Pre-configured loggers for common use cases
 */
export const auditLoggers = {
  /**
   * Development logger with detailed output
   */
  development: new MCPAuthAuditLogger({
    enabled: true,
    minSeverity: 'low',
    includeRequestDetails: true,
    includeSensitiveData: false,
    logger: (entry) => {
      const color = {
        low: '\x1b[32m',    // Green
        medium: '\x1b[33m',  // Yellow
        high: '\x1b[31m',    // Red
        critical: '\x1b[35m' // Magenta
      }[entry.severity];
      
      debugLoggers.audit(`${color}[${entry.severity.toUpperCase()}]\x1b[0m ${JSON.stringify(entry, null, 2)}`);
    }
  }),

  /**
   * Production logger with minimal output
   */
  production: new MCPAuthAuditLogger({
    enabled: true,
    minSeverity: 'medium',
    includeRequestDetails: false,
    includeSensitiveData: false,
    logger: (entry) => {
      // In production, this would typically send to a structured logging service
      debugLoggers.audit(JSON.stringify({
        timestamp: entry.timestamp,
        event: entry.event,
        severity: entry.severity,
        correlationId: entry.correlationId,
        resourceUri: entry.requestInfo?.resourceUri
      }));
    }
  }),

  /**
   * Silent logger for testing
   */
  silent: new MCPAuthAuditLogger({
    enabled: false
  }),

  /**
   * Structured logger for external systems
   */
  structured: new MCPAuthAuditLogger({
    enabled: true,
    minSeverity: 'low',
    includeRequestDetails: true,
    includeSensitiveData: false,
    logger: (entry) => {
      // Example: Send to external logging service
      // await externalLoggingService.log(entry);
      
      // For now, just log to debug in structured format
      debugLoggers.audit(JSON.stringify({
        level: entry.severity,
        message: `Auth event: ${entry.event}`,
        correlationId: entry.correlationId,
        ...entry
      }));
    }
  })
};
