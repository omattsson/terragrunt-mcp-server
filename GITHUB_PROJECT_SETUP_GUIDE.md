# GitHub Project Setup Guide - Custom Views

**Project URL:** https://github.com/users/omattsson/projects/2

## ✅ Custom Fields Created

The following custom fields have been successfully created:

- ✅ **Priority** (Single Select): High, Medium, Low
- ✅ **Feature** (Single Select): Feature 0, Feature 1, Feature 2, Feature 3
- ✅ **Type** (Single Select): Epic, Implementation, Testing, Documentation
- ✅ **Estimated Days** (Number): For time tracking

## 📋 How to Create Custom Views

Since custom views with specific configurations are best created through the GitHub UI, follow these steps:

### Step 1: Access Your Project
1. Visit https://github.com/users/omattsson/projects/2
2. You should see "View 1" as the default view

---

## View 1: By Feature (Group View)

**Purpose:** See progress on each feature at a glance

### Setup Instructions:
1. Click the "➕" button next to "View 1" to create a new view
2. Name it: **"By Feature"**
3. Select layout: **Table** or **Board**
4. Click the **three dots (⋮)** menu → **Group by** → Select **"Feature"**
5. Click **Sort** → Primary sort: **"Feature"**, Secondary sort: **"Status"**
6. Click **Filter** → Add filter: **Status** → Select **"Todo"** and **"In Progress"** (exclude Done)

**Expected Result:** Issues grouped by Feature 0, Feature 1, Feature 2, Feature 3

---

## View 2: By Priority (Board View)

**Purpose:** Focus on high-priority items

### Setup Instructions:
1. Create a new view named: **"By Priority"**
2. Select layout: **Board**
3. **Group by** → Select **"Priority"**
4. **Sort** → Primary: **"Feature"**, Secondary: **"Status"**
5. **Filter** → Status: Exclude "Done"

**Expected Result:** Board columns for High, Medium, Low priority

---

## View 3: Current Sprint (Table View)

**Purpose:** Daily work tracking - see what's actively being worked on

### Setup Instructions:
1. Create a new view named: **"Current Sprint"**
2. Select layout: **Table**
3. **Filter** → Add filter:
   - **Status** → Select **"In Progress"**
   - OR add another filter: **Assignees** → Select **yourself**
4. **Sort** → Primary: **"Priority"**, Secondary: **"Feature"**
5. Show columns: Title, Assignees, Priority, Feature, Type, Estimated Days, Status

**Expected Result:** Only issues currently in progress or assigned to you

---

## View 4: Testing Backlog (Table View)

**Purpose:** See all pending test tasks

### Setup Instructions:
1. Create a new view named: **"Testing Backlog"**
2. Select layout: **Table**
3. **Filter** → Add filters:
   - **Type** → Select **"Testing"**
   - **Status** → Select **"Todo"**
4. **Sort** → Primary: **"Feature"**, Secondary: **"Milestone"**
5. Show columns: Title, Feature, Milestone, Priority, Status

**Expected Result:** All testing tasks that haven't started yet, organized by feature

---

## View 5: Epic Overview (Table View)

**Purpose:** High-level progress tracking of the 4 major features

### Setup Instructions:
1. Create a new view named: **"Epic Overview"**
2. Select layout: **Table**
3. **Filter** → Add filter:
   - **Type** → Select **"Epic"**
4. **Sort** → **"Feature"** or issue number
5. Show columns: Title, Feature, Milestone, Status, Sub-issues progress, Estimated Days

**Expected Result:** Just the 4 epic issues (#8, #9, #10, #11)

---

## View 6: Documentation Tasks (Optional)

**Purpose:** Track all documentation work

### Setup Instructions:
1. Create a new view named: **"Documentation"**
2. Select layout: **Table**
3. **Filter** → **Type** → Select **"Documentation"**
4. **Sort** → **Feature**
5. Show columns: Title, Feature, Status, Assignees

**Expected Result:** All documentation tasks across all features

---

## Quick Setup Workflow

For each view, the process is:
1. Click **"➕ New view"** in the project toolbar
2. Enter the view name
3. Select layout (Table or Board)
4. Configure:
   - **Group by** (if applicable)
   - **Sort** (primary and secondary)
   - **Filter** (to show/hide specific items)
   - **Fields** (which columns to display)
5. Click **Save changes**

---

## Populating Custom Field Values

After creating the views, you'll need to populate the custom fields for each issue. Here's a mapping:

### Priority Field Values:
- **Epic issues (#8, #9, #10):** High
- **Epic issue (#11):** Medium
- **Implementation issues:** High
- **Testing issues:** High (unit, integration, MCP compliance) or Medium (performance, edge cases)
- **Documentation issues:** Medium

### Feature Field Values:
- **Issues #8, #12-#20:** Feature 0
- **Issues #9, #21-#30:** Feature 1
- **Issues #10, #31-#40:** Feature 2
- **Issues #11, #41-#51:** Feature 3

### Type Field Values:
- **Issues #8, #9, #10, #11:** Epic
- **Issues #12-#15, #21-#24, #31-#34, #41-#45:** Implementation
- **Issues #16-#19, #25-#29, #35-#39, #46-#50:** Testing
- **Issues #20, #30, #40, #51:** Documentation

### Estimated Days Field Values:
- **Feature 0 (Epic #8):** 2.5
- **Feature 1 (Epic #9):** 3.5
- **Feature 2 (Epic #10):** 4.5
- **Feature 3 (Epic #11):** 5.5
- **Individual implementation tasks:** 0.5
- **Individual testing tasks:** 0.3
- **Individual documentation tasks:** 0.4

---

## Bulk Edit Instructions

To quickly populate custom fields:

1. In any table view, select multiple issues (checkbox on left)
2. Right-click or use the **bulk edit** menu
3. Set the custom field value for all selected issues at once

**Example:**
- Select all Feature 0 issues (#8, #12-#20)
- Bulk edit → Set **Feature** = "Feature 0"
- Bulk edit → Set **Priority** based on type

---

## Recommended View Order

Arrange your views in this order for best workflow:

1. **Current Sprint** ← Your daily working view
2. **By Feature** ← See overall progress
3. **By Priority** ← Focus on what's most important
4. **Epic Overview** ← Executive summary
5. **Testing Backlog** ← QA tracking
6. **View 1** (default) ← Keep as backup

---

## Automation Rules (Optional Setup)

GitHub Projects supports workflow automation. Consider setting up:

### Auto-move to "In Progress"
- **Trigger:** Issue assigned
- **Action:** Set Status to "In Progress"

### Auto-move to "Done"
- **Trigger:** Issue closed
- **Action:** Set Status to "Done"

### Auto-set Priority from Labels
- **Trigger:** Label "priority: high" added
- **Action:** Set Priority to "High"

To set up automation:
1. Go to project settings (⚙️ gear icon)
2. Click **Workflows**
3. Click **Create workflow**
4. Choose your trigger and action

---

## Tips for Effective Project Management

1. **Start with Epic Overview** - Get the big picture
2. **Use Current Sprint daily** - Focus on what's actively worked on
3. **Review Testing Backlog** before starting new features - Don't accumulate test debt
4. **Group by Feature** when planning sprints - See all work for a feature together
5. **Group by Priority** when triaging - Focus on high-priority items first
6. **Use Milestones** for time-based tracking - They're already set up!

---

## Viewing Milestone Progress

You can also view progress by milestone:

- **Milestone 1:** https://github.com/omattsson/terragrunt-mcp-server/milestone/1
- **Milestone 2:** https://github.com/omattsson/terragrunt-mcp-server/milestone/2
- **Milestone 3:** https://github.com/omattsson/terragrunt-mcp-server/milestone/3
- **Milestone 4:** https://github.com/omattsson/terragrunt-mcp-server/milestone/4
- **Milestone 5:** https://github.com/omattsson/terragrunt-mcp-server/milestone/5

---

## Next Steps

1. ✅ Custom fields created (Priority, Feature, Type, Estimated Days)
2. ⏳ Create the 5 recommended views using the instructions above
3. ⏳ Populate custom field values for all 44 issues
4. ⏳ Set up automation rules (optional)
5. ⏳ Start working on Feature 0 (#12-#20)

**Estimated setup time:** 15-20 minutes to create views and populate fields

Once setup is complete, your project board will provide excellent visibility into progress, priorities, and workflow!
