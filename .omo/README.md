# OMO Setup

OhMyOpenCode project configuration for Aargo Lifestyle Shiprocket integration.

## Structure

```
.omo/
├── config.yaml           # Project configuration
├── workflow.yaml         # Standard workflow definition
├── status/
│   └── current.yaml      # Current session status
├── plans/
│   └── *.md              # Plan documents
├── logs/
│   └── *.log             # Execution logs
├── checkpoints/
│   └── *.json            # Session checkpoints
├── handoff/
│   ├── template.md       # Handoff template
│   └── aargo-lifestyle/  # Project handoffs
└── run-continuation/
    └── *.json            # Run continuation files
```

## Usage

### For Agents

1. Check current status: `read .omo/status/current.yaml`
2. Follow workflow stages in `workflow.yaml`
3. Update status after each stage
4. Create handoff when switching contexts

### For Users

- Plans are stored in `.omo/plans/`
- Status is auto-updated in `.omo/status/current.yaml`
- Logs are in `.omo/logs/`

## Workflow

The standard workflow follows these stages:

1. **Explore** - Understand codebase
2. **Plan** - Create detailed plan
3. **Verify Plan** - Check completeness
4. **Execute** - Make changes
5. **Verify Execution** - Run tests
6. **Document** - Update docs

Each stage has gates that must pass before proceeding.

## Configuration

See `config.yaml` for project-specific settings:

- MCP Server configuration
- WooCommerce plugin requirements
- Deployment targets
- Security settings
- Rollback strategy

## Security

- Auth token required for MCP server
- Allowed origins configured
- Encryption at rest and in transit
- No destructive actions without approval

## Rollback

- Automatic rollback on test failure
- Backup before deploy
- Max 5 history entries
- Immediate rollback strategy
