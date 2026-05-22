# WhatsApp Automation System

A comprehensive WhatsApp automation platform built with Node.js, Next.js, and modern web technologies.

## Features

- **Real-time Messaging**: Send and receive WhatsApp messages in real-time
- **Contact Management**: Import and manage contacts with CSV support
- **Automation Rules**: Create intelligent automation rules based on message content
- **Broadcast Messaging**: Send bulk messages with anti-ban delays
- **Analytics Dashboard**: Monitor message statistics and conversation insights
- **User Authentication**: Secure login system with JWT tokens

## Tech Stack

### Backend
- **Node.js** with Express.js
- **@whiskeysockets/baileys** for WhatsApp Web API
- **Prisma** with PostgreSQL for database
- **Redis** with Bull for queue management
- **Socket.io** for real-time communication
- **JWT** for authentication

### Frontend
- **Next.js 14** with App Router
- **React** with TypeScript
- **Tailwind CSS** for styling
- **NextAuth.js** for authentication
- **Recharts** for data visualization
- **Socket.io-client** for real-time updates

### Infrastructure
- **Docker Compose** for local development
- **PostgreSQL** database
- **Redis** for caching and queues

## Getting Started

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- PostgreSQL (or use Docker)
- Redis (or use Docker)

### Installation

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd whatsapp-system
   npm install
   ```

2. **Environment Setup**:
   ```bash
   # Backend environment
   cp apps/backend/.env.example apps/backend/.env
   # Frontend environment
   cp apps/frontend/.env.example apps/frontend/.env.local
   ```

3. **Database Setup**:
   ```bash
   # Start Docker services
   docker-compose up -d

   # Run database migrations
   cd apps/backend
   npm run db:push
   ```

   If you already have another Postgres instance on port `5432` or Redis on `6379`, this project uses `5433` for Postgres and `6380` for Redis on the host to avoid collisions.

4. **Start Development Servers**:
   ```bash
   # Backend
   cd apps/backend
   npm run dev

   # Frontend (new terminal)
   cd apps/frontend
   npm run dev
   ```

5. **Access the Application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

### First Time Setup

1. **Register/Login**: Create an account at http://localhost:3000/login
2. **Connect WhatsApp**: Go to Settings and scan the QR code
3. **Import Contacts**: Upload a CSV file with phone numbers
4. **Create Automations**: Set up rules for automatic responses
5. **Send Broadcasts**: Create and schedule bulk messages

## Project Structure

```
whatsapp-system/
├── apps/
│   ├── backend/          # Node.js/Express API server
│   │   ├── src/
│   │   │   ├── api/routes/    # API endpoints
│   │   │   ├── auth/          # Authentication middleware
│   │   │   ├── whatsapp/      # WhatsApp integration
│   │   │   ├── automations/   # Automation engine
│   │   │   ├── conversations/ # Message handling
│   │   │   ├── contacts/      # Contact management
│   │   │   ├── broadcasts/    # Bulk messaging
│   │   │   └── analytics/     # Data aggregation
│   │   └── prisma/            # Database schema
│   └── frontend/         # Next.js React application
│       ├── app/               # App Router pages
│       ├── components/        # React components
│       └── lib/               # Utilities
├── docker-compose.yml   # Development services
└── package.json         # Workspace configuration
```

## API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### WhatsApp
- `GET /api/whatsapp/status` - Connection status
- `GET /api/whatsapp/qr` - QR code for connection
- `POST /api/whatsapp/disconnect` - Disconnect WhatsApp

### Conversations
- `GET /api/conversations` - List conversations
- `POST /api/conversations/:id/messages` - Send message

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `POST /api/contacts/import` - Import CSV

### Automations
- `GET /api/automations` - List automation rules
- `POST /api/automations` - Create automation rule

### Broadcasts
- `GET /api/broadcasts` - List broadcasts
- `POST /api/broadcasts` - Create broadcast

### Analytics
- `GET /api/analytics/overview` - Dashboard statistics
- `GET /api/analytics/messages` - Message data

## Development

### Available Scripts

```bash
# Backend
npm run dev          # Start development server
npm run build        # Build for production
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Create and run migrations

# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
```

### Database Schema

The system uses Prisma with PostgreSQL. Key models:
- `User` - System users
- `Contact` - WhatsApp contacts
- `Conversation` - Chat conversations
- `Message` - Individual messages
- `AutomationRule` - Automation configurations
- `Broadcast` - Bulk message campaigns
- `BroadcastRecipient` - Recipients in broadcasts
- `Analytics` - Usage statistics

## Deployment

1. **Build the applications**:
   ```bash
   npm run build --workspace=backend
   npm run build --workspace=frontend
   ```

2. **Environment Variables**: Set production environment variables
3. **Database**: Ensure PostgreSQL and Redis are available
4. **Start Services**: Deploy backend and frontend to your hosting platform

## Security Considerations

- JWT tokens expire in 24 hours
- WhatsApp Web API has rate limits
- Broadcast delays prevent account bans
- All API routes require authentication
- Sensitive data is encrypted in database

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
