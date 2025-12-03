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
    version: '1.0.0',
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
    version: '1.0.0',
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
        description: 'Custom S3 endpoint URL (for LocalStack/MinIO)',
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
    version: '1.0.0',
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

  // Azure Blob Storage Advanced Backend
  {
    id: 'azure-blob-backend-advanced',
    name: 'Azure Blob Storage Advanced Remote State Backend',
    description: 'Advanced Azure Blob Storage backend with multiple authentication methods (Service Principal, MSI, SAS Token, Azure AD) and snapshot support',
    category: 'backend',
    cloudProvider: 'azure',
    source: 'azure-config',
    version: '1.0.0',
    tags: ['remote-state', 'azure', 'azurerm', 'blob-storage', 'backend', 'advanced'],
    variables: [
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
      {
        name: 'subscription_id',
        description: 'Azure subscription ID (optional for scoped access)',
        type: 'string',
        required: false,
        example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        name: 'tenant_id',
        description: 'Azure AD tenant ID for authentication',
        type: 'string',
        required: false,
        example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        name: 'client_id',
        description: 'Service principal client ID',
        type: 'string',
        required: false,
        example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        name: 'client_secret',
        description: 'Service principal client secret',
        type: 'string',
        required: false,
        sensitive: true,
        example: 'your-client-secret',
      },
      {
        name: 'use_msi',
        description: 'Use Managed Service Identity for authentication',
        type: 'boolean',
        required: false,
      },
      {
        name: 'sas_token',
        description: 'Storage SAS token for authentication',
        type: 'string',
        required: false,
        sensitive: true,
        example: 'sv=2021-06-08&ss=b&srt=sco&sp=rwdlacup&se=...',
      },
      {
        name: 'snapshot',
        description: 'Enable snapshot support for point-in-time recovery',
        type: 'boolean',
        required: false,
      },
      {
        name: 'use_azuread_auth',
        description: 'Use Azure AD authentication instead of access keys',
        type: 'boolean',
        required: false,
      },
    ],
    templateHcl: `remote_state {
  backend = "azurerm"
  config = {
    resource_group_name  = "{{resource_group_name}}"
    storage_account_name = "{{storage_account_name}}"
    container_name       = "{{container_name}}"
    key                  = "{{key}}"
{{#subscription_id}}
    subscription_id      = "{{subscription_id}}"
{{/subscription_id}}
{{#tenant_id}}
    tenant_id            = "{{tenant_id}}"
{{/tenant_id}}
{{#client_id}}
    client_id            = "{{client_id}}"
{{/client_id}}
{{#client_secret}}
    client_secret        = "{{client_secret}}"
{{/client_secret}}
{{#use_msi}}
    use_msi              = {{use_msi}}
{{/use_msi}}
{{#sas_token}}
    sas_token            = "{{sas_token}}"
{{/sas_token}}
{{#snapshot}}
    snapshot             = {{snapshot}}
{{/snapshot}}
{{#use_azuread_auth}}
    use_azuread_auth     = {{use_azuread_auth}}
{{/use_azuread_auth}}
  }
}`,
    example: `remote_state {
  backend = "azurerm"
  config = {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "tfstatestorage"
    container_name       = "tfstate"
    key                  = "\${path_relative_to_include(\"site\")}/terraform.tfstate"
    subscription_id      = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    tenant_id            = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    use_azuread_auth     = true
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
    version: '1.0.0',
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

  // GCP GCS Advanced Remote State Backend
  {
    id: 'gcp-gcs-backend-advanced',
    name: 'GCP GCS Advanced Remote State Backend',
    description: 'Advanced Google Cloud Storage backend with KMS encryption, service account impersonation, and custom endpoint support',
    category: 'backend',
    cloudProvider: 'gcp',
    source: 'builtin',
    version: '1.0.0',
    tags: ['remote-state', 'gcs', 'gcp', 'backend', 'advanced'],
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
      {
        name: 'location',
        description: 'Storage location for data residency requirements',
        type: 'string',
        required: false,
        example: 'us-central1',
      },
      {
        name: 'encryption_key',
        description: 'Customer-supplied encryption key (Base64-encoded 256-bit)',
        type: 'string',
        required: false,
        example: 'base64-encoded-key',
      },
      {
        name: 'kms_encryption_key',
        description: 'Cloud KMS key name for encryption',
        type: 'string',
        required: false,
        example: 'projects/PROJECT_ID/locations/LOCATION/keyRings/RING/cryptoKeys/KEY',
      },
      {
        name: 'impersonate_service_account',
        description: 'Service account email for impersonation',
        type: 'string',
        required: false,
        example: 'terraform@project.iam.gserviceaccount.com',
      },
      {
        name: 'storage_custom_endpoint',
        description: 'Custom storage endpoint URL (for emulators or private endpoints)',
        type: 'string',
        required: false,
        example: 'http://localhost:4443/storage/v1/',
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
{{#location}}
    location    = "{{location}}"
{{/location}}
{{#encryption_key}}
    encryption_key = "{{encryption_key}}"
{{/encryption_key}}
{{#kms_encryption_key}}
    kms_encryption_key = "{{kms_encryption_key}}"
{{/kms_encryption_key}}
{{#impersonate_service_account}}
    impersonate_service_account = "{{impersonate_service_account}}"
{{/impersonate_service_account}}
{{#storage_custom_endpoint}}
    storage_custom_endpoint = "{{storage_custom_endpoint}}"
{{/storage_custom_endpoint}}
  }
}`,
    example: `remote_state {
  backend = "gcs"
  config = {
    bucket      = "my-terraform-state"
    prefix      = "terraform/state"
    project     = "my-gcp-project"
    kms_encryption_key = "projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state"
  }
}`,
  },
];
