# Manual Testing Checklist for Complete Templates

> **Purpose**: Real-world validation of auto-generated Complete templates with actual Terraform/Terragrunt and cloud providers  
> **Related**: Issue #145, Category 6 - Real-World Validation  
> **Status**: Optional/Manual (not automated)

## Overview

This checklist provides step-by-step procedures for manually testing schema-generated Complete templates in real-world scenarios. Use this to validate that generated configurations work correctly with actual cloud provider backends.

---

## Prerequisites

### Required Tools

- [ ] **Terraform** 1.5.0 or higher
  ```bash
  terraform version
  ```

- [ ] **Terragrunt** 0.50.0 or higher
  ```bash
  terragrunt --version
  ```

- [ ] **Node.js** 18+ (for running the MCP server)
  ```bash
  node --version
  ```

### Cloud Provider CLI Tools

- [ ] **AWS CLI** (for S3 backend testing)
  ```bash
  aws --version
  aws sts get-caller-identity  # Verify authentication
  ```

- [ ] **Azure CLI** (for Azure Blob testing)
  ```bash
  az --version
  az account show  # Verify authentication
  ```

- [ ] **Google Cloud SDK** (for GCS backend testing)
  ```bash
  gcloud --version
  gcloud auth list  # Verify authentication
  ```

### Cloud Provider Access

- [ ] AWS account with S3 and DynamoDB permissions
- [ ] Azure subscription with Storage Account access
- [ ] GCP project with Cloud Storage permissions

### Test Environment

Create a test directory:
```bash
mkdir -p ~/terragrunt-complete-templates-test
cd ~/terragrunt-complete-templates-test
```

---

## Test 1: AWS S3 Backend - Essential Tier

### 1.1 Setup

Create test infrastructure:
```bash
# Create S3 bucket for state
aws s3 mb s3://my-terragrunt-test-state-$(date +%s) --region us-east-1

# Create DynamoDB table for locking
aws dynamodb create-table \
  --table-name terragrunt-test-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### 1.2 Generate Configuration

Use the MCP server or tool to generate S3 backend config:
```json
{
  "useCase": "remote_state",
  "backend": "s3",
  "tier": "essential",
  "options": {
    "bucket": "my-terragrunt-test-state-NNNN",
    "key": "terraform.tfstate",
    "region": "us-east-1",
    "dynamodb_table": "terragrunt-test-locks"
  }
}
```

Save the generated `terragrunt.hcl` to your test directory.

### 1.3 Create Test Terraform Module

Create `main.tf`:
```hcl
terraform {
  required_version = ">= 1.5"
}

resource "null_resource" "test" {
  triggers = {
    timestamp = timestamp()
  }
}

output "test_output" {
  value = "S3 backend test successful"
}
```

### 1.4 Test Operations

```bash
# Initialize with generated backend config
terragrunt init

# Expected: ✅ Backend initialized successfully
# Expected: ✅ DynamoDB table used for locking
# Expected: ✅ State file created in S3

# Plan changes
terragrunt plan

# Expected: ✅ State read from S3
# Expected: ✅ Lock acquired via DynamoDB

# Apply changes
terragrunt apply -auto-approve

# Expected: ✅ State written to S3
# Expected: ✅ Lock released after apply

# Verify state in S3
aws s3 ls s3://my-terragrunt-test-state-NNNN/

# Expected: ✅ terraform.tfstate file exists
```

### 1.5 Test State Locking

Open two terminal windows and run `terragrunt plan` simultaneously:

**Expected Results**:
- ✅ First process acquires lock
- ✅ Second process waits for lock
- ✅ Second process proceeds after first completes
- ✅ No state corruption

### 1.6 Cleanup

```bash
# Destroy resources
terragrunt destroy -auto-approve

# Delete state bucket
aws s3 rb s3://my-terragrunt-test-state-NNNN --force

# Delete DynamoDB table
aws dynamodb delete-table --table-name terragrunt-test-locks --region us-east-1
```

### 1.7 Test Results

- [ ] Backend initialization successful
- [ ] State locking works correctly
- [ ] State read/write operations function
- [ ] Concurrent access handled properly
- [ ] Generated config is syntactically valid

---

## Test 2: AWS S3 Backend - Complete Tier

### 2.1 Setup

Same as Test 1.1 (reuse or recreate resources)

### 2.2 Generate Complete Configuration

Generate with `tier: "complete"` and test additional attributes:
```json
{
  "useCase": "remote_state",
  "backend": "s3",
  "tier": "complete",
  "options": {
    "bucket": "my-terragrunt-test-state-NNNN",
    "key": "terraform.tfstate",
    "region": "us-east-1",
    "encrypt": true,
    "dynamodb_table": "terragrunt-test-locks",
    "workspace_key_prefix": "workspaces",
    "skip_credentials_validation": false,
    "skip_metadata_api_check": false,
    "skip_region_validation": false,
    "max_retries": 3
  }
}
```

### 2.3 Test Advanced Features

```bash
# Test with encryption enabled
terragrunt init
terragrunt apply -auto-approve

# Verify encryption
aws s3api head-object \
  --bucket my-terragrunt-test-state-NNNN \
  --key terraform.tfstate \
  --query ServerSideEncryption

# Expected: ✅ Output shows "AES256" or "aws:kms"

# Test workspace prefix
terragrunt workspace new test-workspace
terragrunt apply -auto-approve

# Verify workspace state
aws s3 ls s3://my-terragrunt-test-state-NNNN/workspaces/

# Expected: ✅ Workspace-specific state file exists
```

### 2.4 Test Results

- [ ] All Complete tier attributes work
- [ ] Encryption enabled and verified
- [ ] Workspace prefix functions correctly
- [ ] Retry logic handles transient errors
- [ ] No errors with optional attributes

---

## Test 3: Azure Blob Storage Backend

### 3.1 Setup

```bash
# Create resource group
az group create \
  --name terragrunt-test-rg \
  --location eastus

# Create storage account
az storage account create \
  --name terragrunttest$RANDOM \
  --resource-group terragrunt-test-rg \
  --location eastus \
  --sku Standard_LRS

# Create container for state
STORAGE_ACCOUNT_NAME="terragrunttest12345"  # Use actual name from above
az storage container create \
  --name tfstate \
  --account-name $STORAGE_ACCOUNT_NAME

# Get access key
STORAGE_KEY=$(az storage account keys list \
  --account-name $STORAGE_ACCOUNT_NAME \
  --query '[0].value' -o tsv)
```

### 3.2 Generate Configuration

```json
{
  "useCase": "remote_state",
  "backend": "azurerm",
  "tier": "essential",
  "options": {
    "storage_account_name": "terragrunttest12345",
    "container_name": "tfstate",
    "key": "terraform.tfstate"
  }
}
```

Set environment variables:
```bash
export ARM_ACCESS_KEY=$STORAGE_KEY
```

### 3.3 Test Operations

```bash
terragrunt init
terragrunt apply -auto-approve

# Verify state in Azure
az storage blob list \
  --container-name tfstate \
  --account-name $STORAGE_ACCOUNT_NAME \
  --output table

# Expected: ✅ terraform.tfstate blob exists
```

### 3.4 Test Blob Leasing (State Locking)

```bash
# Azure Blob Storage uses blob leasing for locking
# Run concurrent operations to test locking
terragrunt plan &
terragrunt plan &
wait

# Expected: ✅ No concurrent modification errors
```

### 3.5 Cleanup

```bash
terragrunt destroy -auto-approve

# Delete resource group (removes all resources)
az group delete --name terragrunt-test-rg --yes --no-wait
```

### 3.6 Test Results

- [ ] Azure backend initialization successful
- [ ] Blob leasing (locking) works correctly
- [ ] State stored in blob storage
- [ ] Authentication methods work (access key, SAS token, managed identity)
- [ ] Generated config is valid

---

## Test 4: GCP Cloud Storage Backend

### 4.1 Setup

```bash
# Set project
export GCP_PROJECT="my-test-project"
gcloud config set project $GCP_PROJECT

# Create bucket for state
gsutil mb -p $GCP_PROJECT -c STANDARD -l us-east1 \
  gs://terragrunt-test-state-$(date +%s)

# Enable versioning (recommended)
gsutil versioning set on gs://terragrunt-test-state-NNNN
```

### 4.2 Generate Configuration

```json
{
  "useCase": "remote_state",
  "backend": "gcs",
  "tier": "complete",
  "options": {
    "bucket": "terragrunt-test-state-NNNN",
    "prefix": "terraform/state"
  }
}
```

### 4.3 Test Operations

```bash
terragrunt init

# Expected: ✅ GCS backend initialized
# Expected: ✅ State file created in bucket

terragrunt apply -auto-approve

# Verify state in GCS
gsutil ls -r gs://terragrunt-test-state-NNNN/terraform/state/

# Expected: ✅ default.tfstate exists
```

### 4.4 Test State Versioning

```bash
# Make changes and apply multiple times
echo "# change" >> main.tf
terragrunt apply -auto-approve

echo "# change 2" >> main.tf
terragrunt apply -auto-approve

# List object versions
gsutil ls -a gs://terragrunt-test-state-NNNN/terraform/state/default.tfstate

# Expected: ✅ Multiple versions exist
# Expected: ✅ Can roll back to previous versions
```

### 4.5 Cleanup

```bash
terragrunt destroy -auto-approve

# Delete bucket
gsutil -m rm -r gs://terragrunt-test-state-NNNN
```

### 4.6 Test Results

- [ ] GCS backend initialization successful
- [ ] State versioning enabled and functional
- [ ] Object lifecycle policies work (if configured)
- [ ] Service account authentication works
- [ ] Generated config is valid

---

## Test 5: Edge Cases and Error Handling

### 5.1 Missing Backend Resources

**Test**: Initialize without creating bucket/container first

```bash
# Don't create S3 bucket beforehand
terragrunt init

# Expected: ❌ Error message about missing bucket
# Expected: ✅ Error is clear and actionable
```

### 5.2 Invalid Credentials

**Test**: Use invalid or expired credentials

```bash
# Use invalid AWS credentials
export AWS_ACCESS_KEY_ID="invalid"
export AWS_SECRET_ACCESS_KEY="invalid"

terragrunt init

# Expected: ❌ Authentication error
# Expected: ✅ Error message indicates credential issue
```

### 5.3 Network Failures

**Test**: Simulate network issues (if possible)

```bash
# Block network access temporarily or use invalid endpoint
terragrunt init

# Expected: ❌ Network error
# Expected: ✅ Retry logic activates (if configured)
# Expected: ✅ Helpful error message
```

### 5.4 Concurrent State Access

**Test**: Multiple users/processes accessing state simultaneously

```bash
# Terminal 1
terragrunt apply -auto-approve

# Terminal 2 (while Terminal 1 is running)
terragrunt apply -auto-approve

# Expected: ✅ Lock prevents concurrent modifications
# Expected: ✅ Second process waits for first to complete
# Expected: ❌ No state corruption
```

### 5.5 Test Results

- [ ] Missing resources produce clear errors
- [ ] Invalid credentials detected properly
- [ ] Network failures handled gracefully
- [ ] State locking prevents corruption
- [ ] Error messages are actionable

---

## Test 6: Template Rendering Validation

### 6.1 Required-Only Configuration

**Test**: Generate config with only required attributes

```bash
# Minimal S3 config
{
  "bucket": "my-bucket",
  "key": "terraform.tfstate",
  "region": "us-east-1"
}
```

**Expected**:
- ✅ Only required attributes in generated HCL
- ✅ No optional attribute placeholders
- ✅ Valid Terraform syntax

### 6.2 Complete Configuration

**Test**: Generate config with all optional attributes

```bash
# Include every available attribute
{
  "bucket": "my-bucket",
  "key": "terraform.tfstate",
  "region": "us-east-1",
  "encrypt": true,
  "dynamodb_table": "locks",
  "workspace_key_prefix": "env:",
  # ... all other attributes
}
```

**Expected**:
- ✅ All attributes present in generated HCL
- ✅ Proper formatting and indentation
- ✅ Valid Terraform syntax

### 6.3 Partial Configuration

**Test**: Mix of required and some optional attributes

**Expected**:
- ✅ Required attributes always present
- ✅ Provided optional attributes included
- ✅ Omitted optional attributes not in output
- ✅ Valid Terraform syntax

---

## Provider-Specific Notes

### AWS S3

**Authentication Methods**:
- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- AWS credentials file (`~/.aws/credentials`)
- IAM role (EC2, ECS, Lambda)
- AWS SSO

**Common Issues**:
- Bucket must exist before `terraform init`
- DynamoDB table required for locking (optional but recommended)
- Ensure bucket and table are in same region
- Verify IAM permissions include S3 and DynamoDB access

**Required Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/terragrunt-locks"
    }
  ]
}
```

### Azure Blob Storage

**Authentication Methods**:
- Storage account key (via `ARM_ACCESS_KEY`)
- SAS token
- Managed Identity
- Azure CLI authentication

**Common Issues**:
- Storage account name must be globally unique
- Container must exist before init
- Network rules may block access
- Verify storage account allows blob public access setting

**Blob Leasing**:
- Azure uses blob leasing for state locking
- Lease duration is 60 seconds by default
- Force-unlock if lease is stuck: `az storage blob lease break`

### GCP Cloud Storage

**Authentication Methods**:
- Application Default Credentials
- Service account key file
- gcloud CLI authentication

**Common Issues**:
- Bucket name must be globally unique
- Enable Cloud Storage API in project
- Service account needs storage.objects.* permissions
- Versioning recommended but not required

**Permissions**:
Service account needs these roles:
- `roles/storage.objectAdmin` (on bucket)
- `roles/storage.bucketReader` (for listing)

---

## Troubleshooting Guide

### Issue: "Backend initialization failed"

**Symptoms**: `terraform init` fails immediately

**Possible Causes**:
1. Backend storage (bucket/container) doesn't exist
2. Invalid credentials
3. Insufficient permissions
4. Incorrect region/location

**Solutions**:
- Create backend storage manually
- Verify credentials are valid and not expired
- Check IAM/RBAC permissions
- Ensure region matches in all configs

### Issue: "Failed to acquire state lock"

**Symptoms**: Operations hang waiting for lock

**Possible Causes**:
1. Previous operation didn't release lock (crashed)
2. Another process holds the lock
3. Lock table/mechanism not configured

**Solutions**:
```bash
# AWS: Check DynamoDB for stuck locks
aws dynamodb scan --table-name terragrunt-locks

# Force unlock (use with caution!)
terragrunt force-unlock LOCK_ID
```

### Issue: "State file corruption"

**Symptoms**: Invalid JSON in state file

**Possible Causes**:
1. Concurrent writes (locking failed)
2. Network interruption during write
3. Disk full/storage quota exceeded

**Solutions**:
- Restore from backup (if versioning enabled)
- AWS S3: use versioning to retrieve previous version
- Azure/GCP: similarly use versioning features
- Prevent future issues: ensure locking is configured

### Issue: "Permission denied"

**Symptoms**: 403 or access denied errors

**Solutions**:
- AWS: Use `aws sts get-caller-identity` to verify identity
- Azure: Use `az account show` to verify subscription
- GCP: Use `gcloud auth list` to verify authentication
- Check IAM/RBAC policies for required permissions

---

## Test Report Template

After completing manual tests, document results:

```markdown
## Manual Testing Report

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Environment**: [Development/Staging/Production]

### Test Summary

| Test | Backend | Tier | Status | Notes |
|------|---------|------|--------|-------|
| 1    | AWS S3  | Essential | ✅ Pass | All operations successful |
| 2    | AWS S3  | Complete | ✅ Pass | Encryption verified |
| 3    | Azure   | Essential | ✅ Pass | Blob leasing works |
| 4    | GCP     | Complete | ✅ Pass | Versioning enabled |
| 5    | Edge Cases | N/A | ⚠️  Partial | Network test skipped |
| 6    | Rendering | All | ✅ Pass | All tiers validated |

### Issues Found

1. **Issue**: [Description]
   - **Severity**: [Low/Medium/High]
   - **Steps to Reproduce**: [...]
   - **Expected**: [...]
   - **Actual**: [...]

### Recommendations

- [Recommendation 1]
- [Recommendation 2]

### Sign-off

- [ ] All critical tests passed
- [ ] Known issues documented
- [ ] Safe to deploy to production
```

---

## Next Steps

After completing manual testing:

1. **Document Findings**: Record any provider-specific quirks or issues
2. **Update Schemas**: If attributes behave differently than documented, update schemas
3. **Improve Error Messages**: Enhance error handling based on real-world failures
4. **Add Automation**: Consider automating some tests with Terraform Cloud or CI/CD
5. **Update Documentation**: Add learnings to this guide for future testers

---

## Related Documentation

- [Testing Complete Templates](./Testing-Complete-Templates.md) - Automated test documentation
- [Backend Schema Format](./Backend-Schema-Format.md) - Schema structure reference
- [Architecture Overview](./Architecture-Overview.md) - System architecture

---

## Conclusion

This manual testing checklist ensures that auto-generated Complete templates work correctly in real-world scenarios with actual cloud providers. Regular execution of these tests validates the entire template generation pipeline from schema to production use.

**Recommended Frequency**: Run manual tests:
- Before major releases
- After schema changes
- When adding new backend support
- After Terraform/Terragrunt version upgrades
