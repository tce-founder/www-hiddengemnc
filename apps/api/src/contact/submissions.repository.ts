import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Inject, Injectable } from '@nestjs/common';
import type { ContactSubmission } from '@hiddengem/shared';
import { APP_CONFIG, type AppConfig } from '../config';

@Injectable()
export class SubmissionsRepository {
  // Region and credentials come from the Lambda environment (or AWS_PROFILE locally).
  private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async save(submission: ContactSubmission): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + this.config.submissionRetentionDays * 24 * 60 * 60;

    await this.client.send(
      new PutCommand({
        TableName: this.config.submissionsTable,
        Item: { ...submission, ttl },
        // The id is a fresh UUID; this only guards against ever overwriting a record.
        ConditionExpression: 'attribute_not_exists(submissionId)',
      }),
    );
  }
}
