import {
  aws_iam,
  aws_lambda,
  aws_lambda_nodejs,
  CustomResource,
  Duration,
  ITaggable,
  Lazy,
  ResourceProps,
  Stack,
  TagManager,
  TagType,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { ResourceProperties } from '../lambda';

const resourceType = 'Custom::Parameter';

/**
 * Definition of the parameter
 */

export interface ParameterProps
  extends ResourceProps,
    Omit<ResourceProperties, 'tags'> {}

/**
 * An EC2 Key Pair
 */
export class Parameter extends Construct implements ITaggable {
  /**
   * The lambda function that is created
   */
  public readonly lambda: aws_lambda.IFunction;

  /**
   * Resource tags
   */
  public readonly tags: TagManager;

  public readonly parameterVersion: string = '';

  /**
   * Defines a new EC2 Key Pair. The private key will be stored in AWS Secrets Manager
   */
  constructor(scope: Construct, id: string, props: ParameterProps) {
    super(scope, id);
    const stack = Stack.of(this);
    const lambdaName = `${stack.stackName}-Test`;
    const resourceId = 'CustomResourceTestParameter';

    this.lambda = new aws_lambda_nodejs.NodejsFunction(this, lambdaName, {
      entry: path.join(__dirname, '../lambda/index.ts'),
      functionName: lambdaName,
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      description: 'Testing custom CFN resources',
      logRetention: 3,
      timeout: Duration.seconds(30),
    });
    this.lambda.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: [
          'ssm:PutParameter',
          'ssm:GetParameter',
          'ssm:GetParameters',
          'ssm:DeleteParameter',
          'ssm:AddTagsToResource',
          'ssm:RemoveTagsFromResource',
        ],
        resources: [
          `arn:aws:ssm:${stack.region}:${stack.account}:parameter/${resourceId}`,
        ],
      }),
    );

    this.tags = new TagManager(TagType.MAP, resourceType);

    const properties: ResourceProperties = {
      name: props.name,
      value: props.value,
      tags: Lazy.any({
        produce: () => this.tags.renderTags() as Record<string, string>,
      }) as unknown as Record<string, string>,
    };

    const parameter = new CustomResource(this, 'CustomResource', {
      serviceToken: this.lambda.functionArn,
      resourceType: resourceType,
      properties,
    });

    this.parameterVersion = parameter.getAttString('ParameterVersion');
  }
}
