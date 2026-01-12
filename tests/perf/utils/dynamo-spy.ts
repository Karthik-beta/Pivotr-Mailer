import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface DynamoCallStats {
    operation: string;
    tableName: string;
    count: number;
    keys: string[];
}

export class DynamoSpy {
    private calls: DynamoCallStats[] = [];
    private originalSend: any;
    private client: DynamoDBDocumentClient;

    constructor(client: DynamoDBDocumentClient) {
        this.client = client;
        this.originalSend = client.send.bind(client);
    }

    attach() {
        this.client.send = (async (command: any, optionsOrCb?: any, cb?: any) => {
            const opName = command.constructor.name.replace('Command', '');
            const params = command.input;
            const tableName = params.TableName || 'unknown';
            
            // Track key if available (for detecting hot keys)
            let keyStr = 'unknown';
            if (params.Key) {
                keyStr = JSON.stringify(params.Key);
            } else if (params.KeyConditionExpression) {
                keyStr = `Query:${params.KeyConditionExpression}`;
            }

            this.trackCall(opName, tableName, keyStr);

            return this.originalSend(command, optionsOrCb, cb);
        }) as any;
    }

    detach() {
        this.client.send = this.originalSend;
    }

    private trackCall(operation: string, tableName: string, key: string) {
        let entry = this.calls.find(c => c.operation === operation && c.tableName === tableName);
        if (!entry) {
            entry = { operation, tableName, count: 0, keys: [] };
            this.calls.push(entry);
        }
        entry.count++;
        entry.keys.push(key);
    }

    getStats() {
        return this.calls;
    }

    getDuplicateAccessCount() {
        let duplicates = 0;
        this.calls.forEach(stat => {
            const keyCounts = new Map<string, number>();
            stat.keys.forEach(k => keyCounts.set(k, (keyCounts.get(k) || 0) + 1));
            
            keyCounts.forEach((count, key) => {
                if (count > 1 && !key.startsWith('Query')) {
                    duplicates += (count - 1);
                }
            });
        });
        return duplicates;
    }

    reset() {
        this.calls = [];
    }

    generateReport() {
        console.log('\n--- DYNAMODB PERFORMANCE REPORT ---');
        let totalCalls = 0;
        this.calls.forEach(c => {
            console.log(`[${c.operation}] ${c.tableName}: ${c.count} calls`);
            totalCalls += c.count;
        });
        console.log(`Total DB Calls: ${totalCalls}`);
        
        const dupes = this.getDuplicateAccessCount();
        if (dupes > 0) {
            console.warn(`⚠️  WARNING: ${dupes} redundant reads/writes detected!`);
        } else {
            console.log('✅ No redundant key access detected.');
        }
        console.log('-----------------------------------\n');
        return { totalCalls, duplicates: dupes };
    }
}