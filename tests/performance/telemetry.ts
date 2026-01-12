
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface DynamoDBMetric {
    operation: string;
    tableName?: string;
    consumedCapacity?: number;
    count?: number;
    scannedCount?: number;
    timestamp: number;
    durationMs: number;
}

export const metrics: DynamoDBMetric[] = [];

export function resetMetrics() {
    metrics.length = 0;
}

export function instrumentClient(client: DynamoDBClient | DynamoDBDocumentClient) {
    try {
        client.middlewareStack.remove('performanceTelemetry');
    } catch (e) {
        // Ignore if not exists
    }
    client.middlewareStack.add(
        (next, context) => async (args: any) => {
            const start = performance.now();
            const result = await next(args);
            const duration = performance.now() - start;

            // Extract table name safely
            const tableName = args.input.TableName;
            
            const output = result.output as any;
            
            // Extract capacity
            const capacity = output?.ConsumedCapacity;
            let totalCapacity = 0;
            if (capacity) {
                if (Array.isArray(capacity)) {
                     totalCapacity = capacity.reduce((acc: any, c: any) => acc + (c.CapacityUnits || 0), 0);
                } else {
                    totalCapacity = capacity.CapacityUnits || 0;
                }
            }

            metrics.push({
                operation: context.commandName || 'Unknown',
                tableName,
                consumedCapacity: totalCapacity,
                count: output?.Count,
                scannedCount: output?.ScannedCount,
                timestamp: Date.now(),
                durationMs: duration
            });

            return result;
        },
        {
            step: 'deserialize',
            name: 'performanceTelemetry',
            priority: 'low'
        }
    );
}
