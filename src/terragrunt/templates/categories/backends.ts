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
