# Shared Lambda Utilities

This directory contains shared code that is bundled into each Lambda function at build time.

## Modules

### `/dynamodb`
DynamoDB client and helper functions:
- Table operations with proper error handling
- Transaction support for atomic operations
- Idempotency key management

### `/ses`
SES client wrapper:
- Email sending with templating
- Quota management
- Error handling

### `/logging`
Powertools for AWS Lambda setup:
- Structured JSON logging
- Correlation IDs
- Metric emission via EMF

### `/types`
Shared TypeScript types imported from `/shared` at compile time.

## Usage

These modules are copied/bundled into each Lambda's deployment package.
Do NOT import directly from `../../shared` at runtime.

## Best Practices

Per [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html):
- Use structured JSON logging (Powertools Logger)
- Emit metrics asynchronously via EMF (Powertools Metrics)
- Initialize SDK clients outside handler for connection reuse
