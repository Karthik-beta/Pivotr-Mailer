# API Gateway Handler Lambdas

This directory contains Lambda functions that handle API Gateway requests from the frontend.

## Structure

```
api/
├── leads/       # Lead CRUD operations
├── campaigns/   # Campaign management
├── templates/   # Email template CRUD
└── metrics/     # Dashboard metrics
```

## Configuration (All API Handlers)

| Setting | Value |
|---------|-------|
| Runtime | Node.js 20.x |
| Memory | 256 MB |
| Timeout | 10 seconds |
| Reserved Concurrency | 10 (shared) |

## Endpoints

### Leads
- `GET /api/leads` - List leads with pagination
- `GET /api/leads/:id` - Get single lead
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead
- `POST /api/leads/import` - Bulk import

### Campaigns
- `GET /api/campaigns` - List campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `POST /api/campaigns` - Create campaign
- `PUT /api/campaigns/:id` - Update campaign
- `POST /api/campaigns/:id/start` - Start campaign
- `POST /api/campaigns/:id/pause` - Pause campaign
- `POST /api/campaigns/:id/abort` - Abort campaign

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template
- `POST /api/templates/:id/preview` - Preview with Spintax

### Metrics
- `GET /api/metrics/dashboard` - Dashboard overview
- `GET /api/metrics/campaign/:id` - Campaign-specific metrics
