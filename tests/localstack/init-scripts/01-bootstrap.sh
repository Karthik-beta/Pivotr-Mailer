#!/bin/bash
# =============================================================================
# LocalStack Bootstrap Script
# =============================================================================
#
# Creates all AWS resources required for local testing.
# This script is executed automatically by LocalStack on startup
# (via /etc/localstack/init/ready.d mount).
#
# Resources Created:
# - DynamoDB Tables (Leads, Campaigns, Metrics, Logs, Settings)
# - SQS Queues (Sending, Feedback, Verification + DLQs)
# - SNS Topics (Alarms)
# - SES Identity Verification
#
# =============================================================================

set -e

echo "=========================================="
echo "Pivotr Mailer - LocalStack Bootstrap"
echo "=========================================="

REGION="us-east-1"
ENDPOINT="http://localhost:4566"

# Helper function
aws_local() {
    aws --endpoint-url="$ENDPOINT" --region="$REGION" "$@"
}

# =============================================================================
# 1. DynamoDB Tables
# =============================================================================
echo ""
echo "[1/4] Creating DynamoDB Tables..."

# Leads Table
echo "  → Creating LeadsTable..."
aws_local dynamodb create-table \
    --table-name pivotr-leads \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=email,AttributeType=S \
        AttributeName=status,AttributeType=S \
        AttributeName=campaignId,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes \
        '[
            {
                "IndexName": "EmailIndex",
                "KeySchema": [{"AttributeName": "email", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"}
            },
            {
                "IndexName": "StatusIndex",
                "KeySchema": [{"AttributeName": "status", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"}
            },
            {
                "IndexName": "CampaignIndex",
                "KeySchema": [
                    {"AttributeName": "campaignId", "KeyType": "HASH"},
                    {"AttributeName": "status", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]' \
    2>/dev/null || echo "  ✓ LeadsTable already exists"

# Campaigns Table
echo "  → Creating CampaignsTable..."
aws_local dynamodb create-table \
    --table-name pivotr-campaigns \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    2>/dev/null || echo "  ✓ CampaignsTable already exists"

# Metrics Table
echo "  → Creating MetricsTable..."
aws_local dynamodb create-table \
    --table-name pivotr-metrics \
    --attribute-definitions \
        AttributeName=pk,AttributeType=S \
        AttributeName=sk,AttributeType=S \
    --key-schema \
        AttributeName=pk,KeyType=HASH \
        AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    2>/dev/null || echo "  ✓ MetricsTable already exists"

# Logs Table
echo "  → Creating LogsTable..."
aws_local dynamodb create-table \
    --table-name pivotr-logs \
    --attribute-definitions \
        AttributeName=campaignId,AttributeType=S \
        AttributeName=timestamp,AttributeType=S \
        AttributeName=leadId,AttributeType=S \
    --key-schema \
        AttributeName=campaignId,KeyType=HASH \
        AttributeName=timestamp,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes \
        '[
            {
                "IndexName": "LeadLogsIndex",
                "KeySchema": [
                    {"AttributeName": "leadId", "KeyType": "HASH"},
                    {"AttributeName": "timestamp", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]' \
    2>/dev/null || echo "  ✓ LogsTable already exists"

# Settings Table
echo "  → Creating SettingsTable..."
aws_local dynamodb create-table \
    --table-name pivotr-settings \
    --attribute-definitions \
        AttributeName=key,AttributeType=S \
    --key-schema \
        AttributeName=key,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    2>/dev/null || echo "  ✓ SettingsTable already exists"

echo "  ✓ DynamoDB Tables created"

# =============================================================================
# 2. SQS Queues
# =============================================================================
echo ""
echo "[2/4] Creating SQS Queues..."

# Dead Letter Queues first
echo "  → Creating Dead Letter Queues..."
SENDING_DLQ_URL=$(aws_local sqs create-queue --queue-name sending-dlq --output text --query 'QueueUrl' 2>/dev/null || echo "exists")
FEEDBACK_DLQ_URL=$(aws_local sqs create-queue --queue-name feedback-dlq --output text --query 'QueueUrl' 2>/dev/null || echo "exists")
VERIFICATION_DLQ_URL=$(aws_local sqs create-queue --queue-name verification-dlq --output text --query 'QueueUrl' 2>/dev/null || echo "exists")

# Get DLQ ARNs (needed for redrive policy)
SENDING_DLQ_ARN=$(aws_local sqs get-queue-attributes --queue-url "$ENDPOINT/000000000000/sending-dlq" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text 2>/dev/null || echo "")
FEEDBACK_DLQ_ARN=$(aws_local sqs get-queue-attributes --queue-url "$ENDPOINT/000000000000/feedback-dlq" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text 2>/dev/null || echo "")
VERIFICATION_DLQ_ARN=$(aws_local sqs get-queue-attributes --queue-url "$ENDPOINT/000000000000/verification-dlq" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text 2>/dev/null || echo "")

# Main Queues with DLQ redrive policies
echo "  → Creating Sending Queue..."
aws_local sqs create-queue \
    --queue-name sending-queue \
    --attributes "{
        \"VisibilityTimeout\": \"35\",
        \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"$SENDING_DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"
    }" \
    2>/dev/null || echo "  ✓ Sending Queue already exists"

echo "  → Creating Feedback Queue..."
aws_local sqs create-queue \
    --queue-name feedback-queue \
    --attributes "{
        \"VisibilityTimeout\": \"15\",
        \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"$FEEDBACK_DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"
    }" \
    2>/dev/null || echo "  ✓ Feedback Queue already exists"

echo "  → Creating Verification Queue..."
aws_local sqs create-queue \
    --queue-name verification-queue \
    --attributes "{
        \"VisibilityTimeout\": \"20\",
        \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"$VERIFICATION_DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"2\\\"}\"
    }" \
    2>/dev/null || echo "  ✓ Verification Queue already exists"

echo "  ✓ SQS Queues created"

# =============================================================================
# 3. SNS Topics
# =============================================================================
echo ""
echo "[3/4] Creating SNS Topics..."

echo "  → Creating Alarm Topic..."
ALARM_TOPIC_ARN=$(aws_local sns create-topic --name pivotr-alarms --output text --query 'TopicArn' 2>/dev/null || echo "exists")

# Subscribe feedback queue to SNS (for SES notifications)
echo "  → Creating Feedback Topic..."
FEEDBACK_TOPIC_ARN=$(aws_local sns create-topic --name pivotr-ses-feedback --output text --query 'TopicArn' 2>/dev/null || echo "exists")

# Get feedback queue ARN
FEEDBACK_QUEUE_ARN=$(aws_local sqs get-queue-attributes --queue-url "$ENDPOINT/000000000000/feedback-queue" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text 2>/dev/null || echo "")

# Subscribe queue to topic
if [ -n "$FEEDBACK_QUEUE_ARN" ] && [ -n "$FEEDBACK_TOPIC_ARN" ] && [ "$FEEDBACK_TOPIC_ARN" != "exists" ]; then
    aws_local sns subscribe \
        --topic-arn "$FEEDBACK_TOPIC_ARN" \
        --protocol sqs \
        --notification-endpoint "$FEEDBACK_QUEUE_ARN" \
        2>/dev/null || echo "  ✓ Subscription already exists"
fi

echo "  ✓ SNS Topics created"

# =============================================================================
# 4. SES Configuration
# =============================================================================
echo ""
echo "[4/4] Configuring SES..."

echo "  → Verifying email identities..."
aws_local ses verify-email-identity --email-address noreply@pivotr.local 2>/dev/null || echo "  ✓ Identity already verified"
aws_local ses verify-email-identity --email-address test@example.com 2>/dev/null || echo "  ✓ Identity already verified"

# Create configuration set
echo "  → Creating configuration set..."
aws_local ses create-configuration-set --configuration-set-name PivotrLocalConfigSet 2>/dev/null || echo "  ✓ Configuration set already exists"

echo "  ✓ SES configured"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=========================================="
echo "Bootstrap Complete!"
echo "=========================================="
echo ""
echo "Resources created:"
echo "  • 5 DynamoDB Tables"
echo "  • 6 SQS Queues (3 main + 3 DLQ)"
echo "  • 2 SNS Topics"
echo "  • SES Email Identities"
echo ""
echo "Endpoint: $ENDPOINT"
echo ""
