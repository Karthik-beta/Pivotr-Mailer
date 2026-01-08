# AWS Lambda Functions

This directory contains all AWS Lambda function source code for the Pivotr Mailer backend.

## Directory Structure

```
lambda/
├── send-email/           # Email sending Lambda (SES integration)
├── verify-email/         # MyEmailVerifier integration
├── process-feedback/     # SNS/SQS feedback handler (bounces, complaints)
├── lead-import/          # Bulk lead import processing
├── api/                  # API Gateway handler functions
│   ├── leads/            # Lead CRUD operations
│   ├── campaigns/        # Campaign management
│   ├── templates/        # Template CRUD
│   └── metrics/          # Metrics retrieval
└── shared/               # Shared utilities (bundled at build time)
    ├── dynamodb/         # DynamoDB client and helpers
    ├── ses/              # SES client wrapper
    ├── logging/          # Powertools logging setup
    └── types/            # Shared TypeScript types
```

## Development Guidelines

### Reserved Concurrency Limits (MANDATORY)

Per PRD Section 5.3.1, all Lambda functions MUST have explicit concurrency limits:

| Function | Reserved Concurrency |
|----------|---------------------|
| send-email | 5 |
| verify-email | 3 |
| process-feedback | 10 |
| lead-import | 2 |
| api-handlers | 10 |

### Timeout & Memory Limits (MANDATORY)

| Function | Timeout | Memory |
|----------|---------|--------|
| send-email | 30s | 256 MB |
| verify-email | 15s | 256 MB |
| process-feedback | 10s | 128 MB |
| lead-import | 60s | 512 MB |
| api-handlers | 10s | 256 MB |

### Handler Pattern

Each Lambda function must export a `handler` function:

```typescript
import { Handler } from 'aws-lambda';

export const handler: Handler = async (event, context) => {
  // Implementation
};
```

### References

- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Powertools for AWS Lambda (TypeScript)](https://docs.powertools.aws.dev/lambda/typescript/latest/)
