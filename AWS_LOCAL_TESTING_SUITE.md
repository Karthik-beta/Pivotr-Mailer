# Professional Grade Local Testing for Serverless Applications  
## Using AWS SAM, LocalStack, and Jest or Vitest

### Purpose of this Document

This document defines a professional, production grade local testing strategy for a serverless application that uses AWS Lambda and managed AWS services.

The goal is to enable high confidence local testing before deploying to any AWS account, while keeping parity with real AWS behavior as high as practically possible.

This document is intentionally implementation agnostic.  
No code snippets or configuration examples are included.  
The AI agent consuming this document will receive project specific context separately and must infer appropriate implementations.

---

## High Level Testing Goals

The local testing setup must satisfy the following goals:

1. Enable fast feedback during development  
2. Closely match real AWS runtime behavior  
3. Support both synchronous and event driven workflows  
4. Allow deterministic testing of AWS service interactions  
5. Be suitable for CI execution  
6. Minimize manual testing through AWS Console  

---

## Core Tools and Their Roles

### AWS SAM

Use AWS SAM as the primary tool for Lambda execution and API simulation.

Responsibilities:
- Define serverless resources declaratively  
- Build Lambda artifacts in a way consistent with AWS  
- Execute Lambda functions locally using official AWS runtimes  
- Emulate API Gateway behavior for HTTP based Lambdas  
- Provide consistent environment variable handling  

Additional instruction:
- AWS SAM must be installed and configured locally by the AI agent  
- The setup must support local execution and testing without deploying to AWS  

SAM is the authoritative source of truth for how Lambda functions are built and executed.

---

### LocalStack

Use LocalStack to emulate AWS managed services locally.

Responsibilities:
- Provide local equivalents of AWS services  
- Support DynamoDB, SQS, SNS, SES, and partial CloudWatch  
- Accept real AWS SDK calls without code changes  
- Enable event driven flows across services  
- Allow deterministic testing without touching AWS  

Additional instructions:
- LocalStack is already running locally via Docker Desktop  
- No AWS resources exist inside LocalStack initially  
- The AI agent must create and configure all required services inside LocalStack  
- All infrastructure required for local testing must be provisioned explicitly  

LocalStack should be treated as a shared local infrastructure dependency.

---

### Jest or Vitest Decision Guidance

The AI agent must choose between Jest and Vitest only after evaluating project context.

Decision criteria:

Prefer Vitest if:
- The project uses modern ES modules  
- The project is built with Vite or similar tooling  
- Fast incremental test runs are important  
- Native TypeScript support is required with minimal configuration  

Prefer Jest if:
- The project already uses Jest  
- The ecosystem relies heavily on Jest plugins  
- Long term ecosystem stability is prioritized over speed  
- Legacy CommonJS patterns exist  

Only one test runner should be chosen.  
Mixing both is not allowed.

---

## Testing Layers and Responsibilities

### 1. Unit Testing Layer

Purpose:
- Validate pure business logic  
- Validate validation rules and edge cases  
- Validate error handling behavior  

Characteristics:
- No AWS services involved  
- No Docker usage  
- Extremely fast execution  
- Executed on every file save and commit  

Guidelines:
- Lambda handlers must remain thin  
- Business logic must be testable without AWS context  
- External dependencies must be mocked  

---

### 2. Local Lambda Runtime Testing Layer

Purpose:
- Validate Lambda behavior in a real AWS runtime  
- Validate handler wiring and environment variables  
- Validate event payload parsing  

Tooling:
- AWS SAM local execution  

Characteristics:
- Uses Docker  
- Uses official AWS Lambda images  
- High fidelity with production Lambda  

Guidelines:
- Lambda execution must mirror AWS behavior  
- Failures at this level must block deployments  
- Logging behavior should be observable locally  

---

### 3. AWS Service Integration Testing Layer

Purpose:
- Validate interactions between Lambda and AWS services  
- Validate event driven workflows  
- Validate retry and failure behavior  

Tooling:
- LocalStack  

Services covered:
- DynamoDB  
- SQS  
- SNS  
- SES  
- Event driven Lambda invocations  

Guidelines:
- Real AWS SDK clients must be used  
- Endpoints must be configurable via environment  
- Infrastructure must be created deterministically  
- Tests must be repeatable and isolated  

---

### 4. Observability Validation Layer

Purpose:
- Validate logging and monitoring behavior  

What can be tested locally:
- Structured log output  
- Error logs  
- Custom metric payload formatting  

What cannot be fully tested locally:
- CloudWatch alarms  
- Dashboards  
- Metric math  
- Retention policies  

Guidelines:
- Logs must be written to standard output  
- Observability logic must not depend on AWS availability  
- Alarm behavior must be validated in a real AWS environment later  

---

## End to End Local Flow Expectations

A professional local setup must be capable of executing the following flow entirely on a developer machine:

1. API request or event trigger  
2. Lambda execution via SAM  
3. Data persistence to DynamoDB  
4. Message publishing to SNS  
5. Queue fanout to SQS  
6. Downstream Lambda consumption  
7. SES email send simulation  
8. Logging and error capture  

All steps must execute without deploying to AWS.

---

## Environment and Configuration Principles

- All AWS endpoints must be configurable  
- No hardcoded AWS regions or accounts  
- No credentials required for local execution  
- Environment parity across dev, CI, and prod  
- Clear separation of local and cloud configurations  

---

## CI Compatibility Requirements

The local testing stack must:
- Run headlessly in CI  
- Not require AWS credentials  
- Fail deterministically  
- Produce machine readable test output  
- Support parallel execution where possible  

---

## Known Limitations and Accepted Gaps

The following are acceptable and expected limitations:

- CloudWatch alarms cannot be fully validated locally  
- IAM behavior is approximate, not exact  
- SES deliverability cannot be tested locally  
- AWS concurrency limits cannot be replicated accurately  

These must be validated in a dev AWS account.

---

## Success Criteria

This setup is considered successful if:

- Developers can validate behavior without deploying  
- Bugs are caught before reaching AWS  
- CI failures are meaningful and actionable  
- Local behavior closely matches AWS behavior  
- On call incidents reduce due to better pre deploy testing  

---

## Final Instruction to the AI Agent

You will receive project context including:
- Runtime language and version  
- Event sources  
- AWS services used  
- Deployment strategy  

Based on that context:
- Choose Jest or Vitest  
- Set up AWS SAM locally  
- Provision all required services inside LocalStack  
- Define a clean local testing architecture  
- Generate implementation details  
- Maintain strict separation of concerns  
- Optimize for developer experience and correctness  

Do not simplify the architecture at the cost of realism.
