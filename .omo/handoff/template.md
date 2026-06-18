# OMO Handoff Template
# Standard handoff format for agent context passing

project: aargo-lifestyle
integration: shiprocket-mcp
session: "{{SESSION_ID}}"
timestamp: "{{TIMESTAMP}}"
agent: "{{AGENT_NAME}}"

# Context Summary
summary: |
  {{CONTEXT_SUMMARY}}

# Active Work
active_work:
  - task: "{{TASK_NAME}}"
    status: "{{TASK_STATUS}}"
    files: "{{AFFECTED_FILES}}"
    notes: "{{TASK_NOTES}}"

# Decisions Made
decisions:
  - decision: "{{DECISION}}"
    rationale: "{{RATIONALE}}"
    timestamp: "{{DECISION_TIME}}"

# Current State
state:
  branch: "{{GIT_BRANCH}}"
  commit: "{{GIT_COMMIT}}"
  uncommitted: "{{UNCOMMITTED_FILES}}"
  
# Environment
environment:
  node_version: "{{NODE_VERSION}}"
  php_version: "{{PHP_VERSION}}"
  wp_version: "{{WP_VERSION}}"
  wc_version: "{{WC_VERSION}}"
  
# Issues & Blockers
issues:
  - issue: "{{ISSUE}}"
    severity: "{{SEVERITY}}"
    workaround: "{{WORKAROUND}}"

# Next Steps
next_steps:
  - step: "{{NEXT_STEP}}"
    priority: "{{PRIORITY}}"
    notes: "{{STEP_NOTES}}"

# Verification
verification:
  tests_status: "{{TESTS_STATUS}}"
  diagnostics_status: "{{DIAG_STATUS}}"
  security_status: "{{SEC_STATUS}}"
  
# Notes
notes: |
  {{ADDITIONAL_NOTES}}
