/**
 * Backend configuration templates
 * Remote state backends for AWS, Azure, and GCP
 */

import { ConfigTemplate } from '../../../types/templates.js';

export const backendTemplates: ConfigTemplate[] = [
  // AWS S3 Remote State Backend
  {
    id: 'aws-s3-backend',
    name: 'AWS S3 Remote State Backend',
    description: 'Configure S3 backend with DynamoDB locking for AWS',
    category: 'backend',
    cloudProvider: 'aws',
    source: 'gruntwork',
    tags: ['remote-state', 's3', 'dynamodb', 'aws', 'backend'],
    variables: [
      {
        name: 'bucket',
        description: 'S3 bucket name for Terraform state',
        type: 'string',
        required: true,
        example: 'my-terraform-state',
      },
      {
        name: 'key',
        description: 'Path to state file within bucket',
        type: 'string',
        required: true,
        example: '${path_relative_to_include()}/terraform.tfstate',
      },
      {
        name: 'region',
        description: 'AWS region for S3 bucket',
        type: 'string',
        required: true,
        example: 'us-east-1',
      },
      {
        name: 'dynamodb_table',
        description: 'DynamoDB table for state locking',
        type: 'string',
        required: true,
        example: 'terraform-locks',
      },
      {
        name: 'encrypt',
        description: 'Enable encryption at rest',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    ],
    templateHcl: `remote_state {
  backend = "s3"
  config = {
    bucket         = "{{bucket}}"
    key            = "{{key}}"
    region         = "{{region}}"
    encrypt        = {{encrypt}}
    dynamodb_table = "{{dynamodb_table}}"
  }
}`,
    example: `remote_state {
  backend = "s3"
  config = {
    bucket         = "my-terraform-state"
    key            = "\${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}`,
  },

  // AWS S3 Advanced Remote State Backend
  {
    id: 'aws-s3-backend-advanced',
    name: 'AWS S3 Advanced Remote State Backend',
    description: 'Advanced S3 backend with KMS encryption, cross-account access, and custom endpoint support',
    category: 'backend',
    cloudProvider: 'aws',
    source: 'gruntwork',
    tags: ['remote-state', 's3', 'dynamodb', 'aws', 'backend', 'advanced', 'kms', 'cross-account'],
    variables: [
      {
        name: 'bucket',
        description: 'S3 bucket name for Terraform state',
        type: 'string',
        required: true,
        example: 'my-terraform-state',
      },
      {
        name: 'key',
        description: 'Path to state file within bucket',
        type: 'string',
        required: true,
        example: '${path_relative_to_include()}/terraform.tfstate',
      },
      {
        name: 'region',
        description: 'AWS region for S3 bucket',
        type: 'string',
        required: true,
        example: 'us-east-1',
      },
      {
        name: 'dynamodb_table',
        description: 'DynamoDB table for state locking',
        type: 'string',
        required: false,
        example: 'terraform-locks',
      },
      {
        name: 'encrypt',
        description: 'Enable encryption at rest',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
      {
        name: 'kms_key_id',
        description: 'KMS key ARN for server-side encryption',
        type: 'string',
        required: false,
        example: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
      },
      {
        name: 'role_arn',
        description: 'IAM role ARN for cross-account access',
        type: 'string',
        required: false,
        example: 'arn:aws:iam::123456789012:role/TerraformStateRole',
      },
      {
        name: 'session_name',
        description: 'Session name for assumed role',
        type: 'string',
        required: false,
        example: 'terraform-session',
      },
      {
        name: 'profile',
        description: 'AWS CLI profile name for authentication',
        type: 'string',
        required: false,
        example: 'development',
      },
      {
        name: 'endpoint',
        description: 'Custom S3 endpoint URL (for LocalStack/Minio)',
        type: 'string',
        required: false,
        example: 'http://localhost:4566',
      },
      {
        name: 'workspace_key_prefix',
        description: 'Prefix for workspace-specific state files',
        type: 'string',
        required: false,
        example: 'workspaces',
      },
      {
        name: 'skip_credentials_validation',
        description: 'Skip AWS credentials validation',
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
    ],
    templateHcl: `remote_state {
  backend = "s3"
  config = {
    bucket         = "{{bucket}}"
    key            = "{{key}}"
    region         = "{{region}}"
{{#dynamodb_table}}
    dynamodb_table = "{{dynamodb_table}}"
{{/dynamodb_table}}
{{#encrypt}}
    encrypt        = {{encrypt}}
{{/encrypt}}
{{#kms_key_id}}
    kms_key_id     = "{{kms_key_id}}"
{{/kms_key_id}}
{{#role_arn}}
    role_arn       = "{{role_arn}}"
{{/role_arn}}
{{#session_name}}
    session_name   = "{{session_name}}"
{{/session_name}}
{{#profile}}
    profile        = "{{profile}}"
{{/profile}}
{{#endpoint}}
    endpoint       = "{{endpoint}}"
{{/endpoint}}
{{#workspace_key_prefix}}
    workspace_key_prefix = "{{workspace_key_prefix}}"
{{/workspace_key_prefix}}
{{#skip_credentials_validation}}
    skip_credentials_validation = {{skip_credentials_validation}}
{{/skip_credentials_validation}}
  }
}`,
    example: `remote_state {
  backend = "s3"
  config = {
    bucket         = "my-terraform-state"
    key            = "\${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
    kms_key_id     = "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
    role_arn       = "arn:aws:iam::987654321098:role/TerraformStateRole"
  }
}`,
  },

  // Azure Blob Storage Backend
  {
    id: 'azure-blob-backend',
    name: 'Azure Blob Storage Remote State Backend',
    description: 'Configure Azure Blob Storage backend with Azure AD authentication',
    category: 'backend',
    cloudProvider: 'azure',
    source: 'azure-config',
    tags: ['remote-state', 'azure', 'azurerm', 'blob-storage', 'backend'],
    variables: [
      {
        name: 'subscription_id',
        description: 'Azure subscription ID',
        type: 'string',
        required: true,
        example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        name: 'resource_group_name',
        description: 'Resource group containing storage account',
        type: 'string',
        required: true,
        example: 'rg-terraform-state',
      },
      {
        name: 'storage_account_name',
        description: 'Storage account name',
        type: 'string',
        required: true,
        example: 'tfstatestorage',
      },
      {
        name: 'container_name',
        description: 'Blob container name',
        type: 'string',
        required: true,
        example: 'tfstate',
      },
      {
        name: 'key',
        description: 'Path to state file within container',
        type: 'string',
        required: true,
        example: '${path_relative_to_include("site")}/terraform.tfstate',
      },
    ],
    templateHcl: `remote_state {
  backend = "azurerm"
  config = {
    subscription_id      = "{{subscription_id}}"
    resource_group_name  = "{{resource_group_name}}"
    storage_account_name = "{{storage_account_name}}"
    container_name       = "{{container_name}}"
    key                  = "{{key}}"
  }
}`,
    example: `remote_state {
  backend = "azurerm"
  config = {
    subscription_id      = local.subscription_id
    resource_group_name  = local.deployment_storage_resource_group_name
    storage_account_name = local.deployment_storage_account_name
    container_name       = local.tf_container_name
    key                  = "\${path_relative_to_include(\"site\")}/terraform.tfstate"
  }
}`,
  },

  // GCP GCS Remote State Backend
  {
    id: 'gcp-gcs-backend',
    name: 'GCP GCS Remote State Backend',
    description: 'Configure Google Cloud Storage as remote state backend',
    category: 'backend',
    cloudProvider: 'gcp',
    source: 'builtin',
    tags: ['remote-state', 'gcs', 'gcp', 'backend'],
    variables: [
      {
        name: 'bucket',
        description: 'GCS bucket name for remote state',
        type: 'string',
        required: true,
        example: 'my-terraform-state',
      },
      {
        name: 'prefix',
        description: 'Path prefix within bucket',
        type: 'string',
        required: true,
        example: 'terraform/state',
      },
      {
        name: 'project',
        description: 'GCP project ID',
        type: 'string',
        required: false,
        example: 'my-gcp-project',
      },
      {
        name: 'credentials',
        description: 'Path to GCP credentials file',
        type: 'string',
        required: false,
        example: '/path/to/credentials.json',
      },
    ],
    templateHcl: `remote_state {
  backend = "gcs"
  config = {
    bucket      = "{{bucket}}"
    prefix      = "{{prefix}}"
{{#project}}
    project     = "{{project}}"
{{/project}}
{{#credentials}}
    credentials = "{{credentials}}"
{{/credentials}}
  }
}`,
    example: `remote_state {
  backend = "gcs"
  config = {
    bucket      = "my-terraform-state"
    prefix      = "terraform/state"
    project     = "my-gcp-project"
  }
}`,
  },
];
