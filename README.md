# The Sandwich Project Platform

A comprehensive web-based management system for **The Sandwich Project** nonprofit organization, handling sandwich collections, volunteer coordination, event management, and operational analytics.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd Sandwich-Project-Platform-Final

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 4. Initialize database
npm run db:push
npm run db:seed

# 5. Start development server
npm run dev
```

**Application URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Monitoring Dashboard: http://localhost:5000/monitoring/dashboard

---

## What This Platform Does

The Sandwich Project Platform helps nonprofits manage:

- **Sandwich Collections** - Track pickups, distributions, and inventory
- **Volunteer Management** - Coordinate drivers, hosts, and staff
- **Event Requests** - Handle distribution event intake and scheduling
- **Project Management** - Organize initiatives and campaigns
- **Real-time Messaging** - Coordinate teams via built-in chat
- **Notifications** - Email and SMS alerts via SendGrid and Twilio
- **Analytics** - Track impact, donations, and volunteer hours
- **Meeting Management** - Create agendas, take notes, generate PDF minutes

---

## Technology Stack

### Frontend
- **React 18** - UI library with hooks
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **TanStack Query** - Server state management
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **Socket.IO Client** - Real-time features

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Drizzle ORM** - Type-safe database queries
- **PostgreSQL** - Production database (Neon serverless)
- **SQLite** - Development database
- **Socket.IO** - WebSocket server
- **Winston** - Structured logging
- **Sentry** - Error tracking

### Infrastructure
- **Replit** - Hosting and deployment
- **Neon** - Serverless PostgreSQL
- **SendGrid** - Transactional email
- **Twilio** - SMS messaging
- **Google Cloud** - File storage, Sheets integration

---

## Project Structure

```
/
├── client/              # React frontend application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page-level components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Client utilities
│   └── index.css        # Global styles
│
├── server/              # Express backend application
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic layer
│   ├── middleware/      # Express middleware
│   ├── monitoring/      # Metrics, health checks, alerts
│   └── utils/           # Server utilities
│
├── shared/              # Code shared between client & server
│   ├── schema.ts        # Database schema (Drizzle)
│   ├── types.ts         # TypeScript type definitions
│   └── permission-config.ts  # Role-based access control
│
├── tests/               # Test files
│   ├── integration/     # API integration tests
│   ├── unit/            # Unit tests
│   └── utils/           # Test utilities
│
├── e2e/                 # Playwright end-to-end tests
├── docs/                # Additional documentation
├── migrations/          # Database migrations
└── scripts/             # Utility scripts
```

---

## Documentation

### Getting Started

- **[Developer Setup](docs/DEVELOPER_SETUP.md)** - Set up your development environment
- **[Architecture Overview](ARCHITECTURE.md)** - System design and components
- **[Contributing Guide](CONTRIBUTING.md)** - Code standards and workflow

### Operations & Deployment

- **[Deployment Guide](DEPLOYMENT.md)** - Deploy to production
- **[Monitoring Guide](MONITORING.md)** - Observability and metrics
- **[Alerting Setup](docs/ALERTING_SETUP.md)** - Configure monitoring alerts
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions

### Maintainer Resources

- **[Handoff Guide](HANDOFF.md)** - For new maintainers taking over the project
- **[Testing Guide](TESTING.md)** - Testing infrastructure and best practices

### Specialized Topics

- **[Security & Permissions](docs/SECURITY-NUMERIC-PERMISSIONS.md)** - Role-based access control
- **[Notification System](server/services/notifications/README.md)** - Email/SMS notifications
- **[Folder Structure](server/FOLDER_STRUCTURE.md)** - Server code organization

---

## Development

### Available Commands

```bash
# Development
npm run dev              # Start development server (Vite + API)
npm run dev:client       # Start client only
npm run dev:server       # Start server only

# Building
npm run build            # Build for production
npm run typecheck        # Check TypeScript types
npm run lint             # Run ESLint

# Testing
npm run test             # Run unit + integration tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:e2e         # Run end-to-end tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Database
npm run db:push          # Apply schema to database
npm run db:seed          # Seed database with sample data
npm run db:reset         # Reset database (clean slate)
npm run db:studio        # Open Drizzle Studio (DB GUI)

# Production
npm run start            # Start production server
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql://... (or use SQLite locally)

# Session
SESSION_SECRET=your-secret-key-min-32-chars

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxxxx
NOTIFICATION_FROM_EMAIL=noreply@yourdomain.com

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890

# Monitoring
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# Optional
NODE_ENV=development
LOG_LEVEL=debug
```

### Testing

**Test Coverage Goals:**
- Server: 60% minimum, 70%+ target
- Client: 40% minimum, 60%+ target
- Critical paths (auth, permissions): 90%+ required

**Writing Tests:**

```typescript
// Unit test example
import { hasPermission } from './auth-utils';

test('admin has all permissions', () => {
  expect(hasPermission({ role: 'admin' }, 'users:delete')).toBe(true);
});

// Integration test example
import request from 'supertest';
import { app } from './server';

test('GET /api/users returns user list', async () => {
  const response = await request(app).get('/api/users');
  expect(response.status).toBe(200);
});
```

See **[TESTING.md](TESTING.md)** for comprehensive testing guide.

---

## Monitoring & Observability

### Built-in Monitoring

The platform includes enterprise-grade monitoring:

- **Sentry** - Error tracking and performance monitoring
- **Prometheus Metrics** - Exposed at `/monitoring/metrics`
- **Health Checks** - `/monitoring/health`, `/monitoring/health/detailed`
- **Real-time Dashboard** - `/monitoring/dashboard`
- **Structured Logging** - Winston JSON logs
- **Audit Trail** - User activity logging

### Key Metrics Tracked

- HTTP request duration and count
- Database query performance
- WebSocket connections
- Memory and CPU usage
- Business metrics (users, collections, notifications)
- External API calls

**Access monitoring:** Visit http://localhost:5000/monitoring/dashboard

See **[MONITORING.md](MONITORING.md)** for details.

---

## Deployment

### Production Deployment (Replit)

```bash
# 1. Push to deployment branch
git push origin claude/improve-documentation-monitoring-011CUTLxfsddjoAvriqLZo1q

# 2. Replit auto-deploys
# Monitor deployment in Replit dashboard

# 3. Verify deployment
curl https://[REPLIT_DOMAIN]/monitoring/health
```

### Deployment Checklist

- [ ] All tests pass
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Documentation updated
- [ ] Monitoring alerts active
- [ ] Rollback plan ready

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for comprehensive deployment guide.

---

## Security

### Authentication & Authorization

- **Session-based authentication** with secure cookies
- **Role-based access control (RBAC)** with granular permissions
- **Password hashing** via bcrypt
- **Audit logging** for sensitive actions

### Roles & Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| **Admin** | Full system access | All permissions |
| **Staff** | Operational management | Most features, limited user management |
| **Volunteer** | Drivers, hosts, helpers | View own data, basic operations |
| **Recipient** | Event organizers | Request events, view own events |

See **[SECURITY-NUMERIC-PERMISSIONS.md](docs/SECURITY-NUMERIC-PERMISSIONS.md)** for details.

---

## Contributing

We welcome contributions! Please read our **[Contributing Guide](CONTRIBUTING.md)** for:

- Code style and standards
- Development workflow
- Testing requirements
- Pull request process

### Quick Contribution Workflow

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make changes and test
npm run test:all

# 3. Commit with conventional commits
git commit -m "feat(feature): description"

# 4. Push and create PR
git push origin feature/your-feature-name
```

---

## Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check port availability
lsof -i :5000

# Reinstall dependencies
rm -rf node_modules && npm install
```

**Database connection failed:**
```bash
# Verify environment variables
echo $DATABASE_URL

# Reset local database
npm run db:reset
```

**Tests failing:**
```bash
# Reset test database
npm run db:reset
npm run db:seed
```

For comprehensive troubleshooting, see **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**.

---

## Maintainer Handoff

**Are you taking over this project?** Start here:

1. Read **[HANDOFF.md](HANDOFF.md)** - Critical for new maintainers
2. Complete the "First Week" checklist in the handoff guide
3. Set up monitoring alerts (see **[ALERTING_SETUP.md](docs/ALERTING_SETUP.md)**)
4. Familiarize yourself with deployment process

The handoff guide contains everything you need to successfully maintain this project.

---

## Architecture Highlights

### Three-Tier Architecture

```
┌─────────────────────────┐
│   React Frontend (SPA)   │  Vite, TanStack Query, Tailwind
└─────────────────────────┘
            ↕
┌─────────────────────────┐
│   Express REST API       │  TypeScript, Session Auth, WebSockets
└─────────────────────────┘
            ↕
┌─────────────────────────┐
│   PostgreSQL Database    │  Drizzle ORM, Neon Serverless
└─────────────────────────┘
```

### Key Design Principles

- **Type Safety** - TypeScript everywhere, shared types between client/server
- **Testing** - Comprehensive test coverage with Jest and Playwright
- **Observability** - Built-in monitoring, logging, and error tracking
- **Security** - RBAC, input validation, audit logging
- **Maintainability** - Clean code, documentation, modular architecture

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for detailed system design.

---

## Performance

### Optimization Features

- **Code Splitting** - React lazy loading for routes
- **Query Optimization** - Indexed database queries
- **Caching** - TanStack Query client-side caching
- **Connection Pooling** - Efficient database connections
- **Static Asset Optimization** - Vite production builds

### Monitoring Performance

- View metrics at `/monitoring/dashboard`
- Track response times with Prometheus
- Monitor database query performance
- Profile with Sentry performance monitoring

---

## Support & Resources

### Getting Help

- **Documentation** - Start with docs listed above
- **Issues** - Search existing GitHub issues
- **Maintainer** - Contact info in [HANDOFF.md](HANDOFF.md)

### Useful Links

- **Replit Docs:** https://docs.replit.com
- **Drizzle ORM:** https://orm.drizzle.team
- **React Docs:** https://react.dev
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/

---

## License

[Add your license here - MIT, Apache 2.0, etc.]

---

## Acknowledgments

Built with love for The Sandwich Project nonprofit organization and the community it serves.

---

## Changelog

See commit history for detailed changes:
```bash
git log --oneline --graph
```

---

**Last Updated:** 2025-10-25

For questions or issues, please open a GitHub issue or contact the maintainer.
