# Complete Technical Roadmap: Real Data Implementation
## GMB Local Rank Tracker with Next.js, Clerk & Neon

**Last Updated:** 2025-11-10
**Target Stack:** Next.js 15 (App Router) + Clerk.com + Neon PostgreSQL

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Design](#architecture-design)
4. [Database Schema](#database-schema)
5. [Implementation Phases](#implementation-phases)
6. [API Integration Strategy](#api-integration-strategy)
7. [Authentication & Authorization](#authentication--authorization)
8. [Data Flow & State Management](#data-flow--state-management)
9. [Real-Time Ranking Implementation](#real-time-ranking-implementation)
10. [Performance Optimization](#performance-optimization)
11. [Security Considerations](#security-considerations)
12. [Testing Strategy](#testing-strategy)
13. [Deployment Pipeline](#deployment-pipeline)

---

## Project Overview

### Current State
- **Framework:** Vite + React + TypeScript
- **Data:** Mock data service with local storage
- **Authentication:** None
- **Database:** None (localStorage only)
- **APIs:** Google Maps, Google Places, Google Gemini AI

### Target State
- **Framework:** Next.js 15 with App Router
- **Authentication:** Clerk.com (OAuth, email, magic links)
- **Database:** Neon PostgreSQL (serverless)
- **Data:** Real ranking data from Google Places API
- **APIs:** Google Maps, Google Places, Google Gemini AI (server-side)

---

## Technology Stack

### Frontend
```
Next.js 15.x          - React framework with App Router
React 19.x            - UI library
TypeScript 5.8.x      - Type safety
Tailwind CSS 4.x      - Styling
@googlemaps/js-api    - Google Maps integration
```

### Backend
```
Next.js API Routes    - Server-side logic
Neon PostgreSQL       - Serverless database
@neondatabase/serverless - Database driver
Drizzle ORM / Prisma  - Type-safe database access
@google/genai         - Gemini AI SDK
```

### Authentication
```
@clerk/nextjs         - Authentication provider
Clerk Webhooks        - User lifecycle management
```

### Infrastructure
```
Vercel                - Deployment platform
Neon                  - Database hosting
Clerk                 - Auth service
Google Cloud          - Maps & Gemini APIs
```

---

## Architecture Design

### Directory Structure
```
gmb-rank-tracker/
├── app/
│   ├── (auth)/                    # Auth group
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/               # Protected routes
│   │   ├── layout.tsx             # Dashboard layout
│   │   ├── page.tsx               # Main dashboard
│   │   ├── scans/
│   │   │   ├── page.tsx           # Scan list
│   │   │   ├── [id]/page.tsx      # Scan detail
│   │   │   └── new/page.tsx       # New scan
│   │   ├── businesses/
│   │   │   ├── page.tsx           # Business list
│   │   │   └── [id]/page.tsx      # Business detail
│   │   └── settings/
│   │       └── page.tsx           # User settings
│   ├── api/
│   │   ├── scans/
│   │   │   ├── route.ts           # Create/list scans
│   │   │   ├── [id]/route.ts      # Get/update scan
│   │   │   └── [id]/execute/route.ts # Run scan
│   │   ├── businesses/
│   │   │   ├── route.ts           # CRUD operations
│   │   │   └── search/route.ts    # Google Places search
│   │   ├── insights/
│   │   │   ├── ranking/route.ts   # Ranking insights
│   │   │   ├── competitor/route.ts # Competitor analysis
│   │   │   └── review/route.ts    # Review analysis
│   │   ├── webhooks/
│   │   │   └── clerk/route.ts     # Clerk user sync
│   │   └── cron/
│   │       └── scheduled-scans/route.ts
│   ├── layout.tsx                 # Root layout
│   ├── globals.css                # Global styles
│   └── providers.tsx              # Client providers
├── components/
│   ├── ui/                        # Shared UI components
│   ├── maps/
│   │   ├── MapDisplay.tsx
│   │   ├── RankingMarker.tsx
│   │   └── HeatmapLayer.tsx
│   ├── scans/
│   │   ├── ScanForm.tsx
│   │   ├── ScanResults.tsx
│   │   └── ScanHistory.tsx
│   └── insights/
│       └── InsightPanel.tsx
├── lib/
│   ├── db/
│   │   ├── schema.ts              # Database schema
│   │   ├── client.ts              # Neon client
│   │   └── migrations/
│   ├── services/
│   │   ├── google-places.ts       # Places API
│   │   ├── gemini.ts              # Gemini AI
│   │   └── ranking.ts             # Ranking logic
│   ├── auth/
│   │   └── clerk.ts               # Clerk helpers
│   └── utils/
│       ├── maps.ts
│       └── calculations.ts
├── middleware.ts                  # Clerk middleware
├── .env.local                     # Environment variables
└── next.config.js                 # Next.js config
```

---

## Database Schema

### Neon PostgreSQL Schema

```sql
-- Users table (synced from Clerk)
CREATE TABLE users (
    id TEXT PRIMARY KEY,              -- Clerk user ID
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Businesses (tracked locations)
CREATE TABLE businesses (
    id TEXT PRIMARY KEY,              -- Google Place ID
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    place_id TEXT UNIQUE,             -- Google Place ID
    phone TEXT,
    website TEXT,
    category TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, place_id)
);

-- Scans (ranking analysis sessions)
CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    grid_size TEXT NOT NULL,
    grid_cols INTEGER NOT NULL,
    grid_rows INTEGER NOT NULL,
    distance_km DECIMAL(6, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Scan Results (individual grid points)
CREATE TABLE scan_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    point_index INTEGER NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    rank INTEGER NOT NULL,            -- Target business rank
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(scan_id, point_index)
);

-- Competitor Rankings (detailed ranking at each point)
CREATE TABLE competitor_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_result_id UUID NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
    business_id TEXT,                 -- Can be NULL for unknown competitors
    competitor_name TEXT NOT NULL,
    competitor_address TEXT,
    competitor_place_id TEXT,
    rank INTEGER NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Scan Summary Statistics
CREATE TABLE scan_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    average_rank DECIMAL(5, 2) NOT NULL,
    top_3_percentage DECIMAL(5, 2) NOT NULL,
    top_10_percentage DECIMAL(5, 2) NOT NULL,
    total_points INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(scan_id)
);

-- Competitors (discovered businesses)
CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id TEXT UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    category TEXT,
    first_seen_scan_id UUID REFERENCES scans(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Insights (cached Gemini responses)
CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL,       -- ranking, competitor, review
    content TEXT NOT NULL,
    sources JSONB,                    -- Array of grounding sources
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(scan_id, insight_type)
);

-- Scheduled Scans (recurring scans)
CREATE TABLE scheduled_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    grid_size TEXT NOT NULL,
    frequency TEXT NOT NULL,          -- daily, weekly, monthly
    next_run TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Settings
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    google_api_key TEXT,              -- Optional user API key
    default_grid_size TEXT DEFAULT '15 x 11 (4 km)',
    email_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX idx_businesses_user_id ON businesses(user_id);
CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_business_id ON scans(business_id);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX idx_competitor_rankings_scan_result_id ON competitor_rankings(scan_result_id);
CREATE INDEX idx_insights_scan_id ON insights(scan_id);
CREATE INDEX idx_scheduled_scans_next_run ON scheduled_scans(next_run) WHERE is_active = TRUE;
```

---

## Implementation Phases

### Phase 1: Project Setup & Migration (Week 1)

#### 1.1 Initialize Next.js Project
```bash
# Create new Next.js app
npx create-next-app@latest gmb-rank-tracker-nextjs --typescript --tailwind --app

# Install core dependencies
npm install @clerk/nextjs @neondatabase/serverless
npm install @google/genai
npm install drizzle-orm drizzle-kit
npm install zod
npm install react-hook-form @hookform/resolvers
npm install date-fns
npm install @tanstack/react-query
```

#### 1.2 Environment Configuration
```env
# .env.local
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Neon Database
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require

# Google APIs
GOOGLE_MAPS_API_KEY=AIza...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
GEMINI_API_KEY=AIza...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 1.3 Configure Clerk Middleware
```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

#### 1.4 Setup Neon Database
```typescript
// lib/db/client.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

#### 1.5 Migrate Existing Components
- Copy and adapt React components to Next.js structure
- Convert client components with 'use client' directive
- Create server components for static content

---

### Phase 2: Authentication & User Management (Week 1-2)

#### 2.1 Clerk Integration

```typescript
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

```typescript
// app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
```

#### 2.2 User Sync Webhook

```typescript
// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET!);

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id!,
      'svix-timestamp': svix_timestamp!,
      'svix-signature': svix_signature!,
    }) as WebhookEvent;
  } catch (err) {
    return new Response('Error verifying webhook', { status: 400 });
  }

  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    await db
      .insert(users)
      .values({
        id,
        email: email_addresses[0].email_address,
        first_name,
        last_name,
        image_url,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: email_addresses[0].email_address,
          first_name,
          last_name,
          image_url,
          updated_at: new Date(),
        },
      });
  }

  if (eventType === 'user.deleted') {
    await db.delete(users).where(eq(users.id, evt.data.id!));
  }

  return new Response('', { status: 200 });
}
```

#### 2.3 Protected Route Layout

```typescript
// app/(dashboard)/layout.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = auth();

  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex h-[calc(100vh-4rem)]">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

### Phase 3: Database Schema & ORM Setup (Week 2)

#### 3.1 Drizzle Schema Definition

```typescript
// lib/db/schema.ts
import { pgTable, text, timestamp, decimal, integer, boolean, uuid, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const businesses = pgTable('businesses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 8 }).notNull(),
  longitude: decimal('longitude', { precision: 11, scale: 8 }).notNull(),
  placeId: text('place_id').unique(),
  phone: text('phone'),
  website: text('website'),
  category: text('category'),
  isPrimary: boolean('is_primary').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const scans = pgTable('scans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  searchQuery: text('search_query').notNull(),
  gridSize: text('grid_size').notNull(),
  gridCols: integer('grid_cols').notNull(),
  gridRows: integer('grid_rows').notNull(),
  distanceKm: decimal('distance_km', { precision: 6, scale: 2 }).notNull(),
  status: text('status').notNull().default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const scanResults = pgTable('scan_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  scanId: uuid('scan_id').notNull().references(() => scans.id, { onDelete: 'cascade' }),
  pointIndex: integer('point_index').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 8 }).notNull(),
  longitude: decimal('longitude', { precision: 11, scale: 8 }).notNull(),
  rank: integer('rank').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const competitorRankings = pgTable('competitor_rankings', {
  id: uuid('id').defaultRandom().primaryKey(),
  scanResultId: uuid('scan_result_id').notNull().references(() => scanResults.id, { onDelete: 'cascade' }),
  businessId: text('business_id'),
  competitorName: text('competitor_name').notNull(),
  competitorAddress: text('competitor_address'),
  competitorPlaceId: text('competitor_place_id'),
  rank: integer('rank').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const scanSummaries = pgTable('scan_summaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  scanId: uuid('scan_id').notNull().references(() => scans.id, { onDelete: 'cascade' }).unique(),
  averageRank: decimal('average_rank', { precision: 5, scale: 2 }).notNull(),
  top3Percentage: decimal('top_3_percentage', { precision: 5, scale: 2 }).notNull(),
  top10Percentage: decimal('top_10_percentage', { precision: 5, scale: 2 }).notNull(),
  totalPoints: integer('total_points').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insights = pgTable('insights', {
  id: uuid('id').defaultRandom().primaryKey(),
  scanId: uuid('scan_id').notNull().references(() => scans.id, { onDelete: 'cascade' }),
  insightType: text('insight_type').notNull(),
  content: text('content').notNull(),
  sources: jsonb('sources'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  scans: many(scans),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  user: one(users, {
    fields: [businesses.userId],
    references: [users.id],
  }),
  scans: many(scans),
}));

export const scansRelations = relations(scans, ({ one, many }) => ({
  user: one(users, {
    fields: [scans.userId],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [scans.businessId],
    references: [businesses.id],
  }),
  results: many(scanResults),
  summary: one(scanSummaries),
  insights: many(insights),
}));
```

#### 3.2 Run Migrations

```bash
# Generate migration
npx drizzle-kit generate:pg

# Push to Neon
npx drizzle-kit push:pg
```

---

### Phase 4: Google Places API Integration (Week 2-3)

#### 4.1 Business Search Service

```typescript
// lib/services/google-places.ts
import { Client } from '@googlemaps/google-maps-services-js';

const client = new Client({});

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  totalRatings?: number;
  phone?: string;
  website?: string;
}

export async function searchPlaces(
  query: string,
  location: { lat: number; lng: number },
  radius: number = 50000
): Promise<PlaceSearchResult[]> {
  try {
    const response = await client.textSearch({
      params: {
        query,
        location,
        radius,
        key: process.env.GOOGLE_MAPS_API_KEY!,
      },
    });

    return response.data.results.map((place) => ({
      placeId: place.place_id!,
      name: place.name!,
      address: place.formatted_address!,
      latitude: place.geometry!.location.lat,
      longitude: place.geometry!.location.lng,
      rating: place.rating,
      totalRatings: place.user_ratings_total,
    }));
  } catch (error) {
    console.error('Error searching places:', error);
    throw new Error('Failed to search places');
  }
}

export async function getPlaceDetails(placeId: string): Promise<PlaceSearchResult> {
  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'geometry',
          'rating',
          'user_ratings_total',
          'formatted_phone_number',
          'website',
        ],
        key: process.env.GOOGLE_MAPS_API_KEY!,
      },
    });

    const place = response.data.result;
    return {
      placeId: place.place_id!,
      name: place.name!,
      address: place.formatted_address!,
      latitude: place.geometry!.location.lat,
      longitude: place.geometry!.location.lng,
      rating: place.rating,
      totalRatings: place.user_ratings_total,
      phone: place.formatted_phone_number,
      website: place.website,
    };
  } catch (error) {
    console.error('Error getting place details:', error);
    throw new Error('Failed to get place details');
  }
}

export async function nearbySearch(
  location: { lat: number; lng: number },
  keyword: string,
  radius: number = 5000
): Promise<PlaceSearchResult[]> {
  try {
    const response = await client.placesNearby({
      params: {
        location,
        keyword,
        radius,
        rankby: 'prominence',
        key: process.env.GOOGLE_MAPS_API_KEY!,
      },
    });

    return response.data.results.map((place) => ({
      placeId: place.place_id!,
      name: place.name!,
      address: place.vicinity!,
      latitude: place.geometry!.location.lat,
      longitude: place.geometry!.location.lng,
      rating: place.rating,
      totalRatings: place.user_ratings_total,
    }));
  } catch (error) {
    console.error('Error in nearby search:', error);
    throw new Error('Failed to perform nearby search');
  }
}
```

#### 4.2 API Route for Business Search

```typescript
// app/api/businesses/search/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { searchPlaces } from '@/lib/services/google-places';
import { z } from 'zod';

const searchSchema = z.object({
  query: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  radius: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { query, latitude, longitude, radius } = searchSchema.parse(body);

    const results = await searchPlaces(
      query,
      { lat: latitude, lng: longitude },
      radius
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Business search error:', error);
    return NextResponse.json(
      { error: 'Failed to search businesses' },
      { status: 500 }
    );
  }
}
```

---

### Phase 5: Real Ranking Data Collection (Week 3-4)

#### 5.1 Ranking Service

```typescript
// lib/services/ranking.ts
import { nearbySearch, PlaceSearchResult } from './google-places';

export interface GridConfig {
  cols: number;
  rows: number;
  distanceKm: number;
}

export interface GridPoint {
  index: number;
  lat: number;
  lng: number;
}

export interface RankingResult {
  point: GridPoint;
  targetRank: number;
  rankings: Array<{
    rank: number;
    place: PlaceSearchResult;
  }>;
}

export function parseGridSize(gridSizeStr: string): GridConfig {
  const sizeMatch = gridSizeStr.match(/(\d+)\s*x\s*(\d+)/);
  const distanceMatch = gridSizeStr.match(/\(([\d.]+)\s*km\)/);

  const cols = sizeMatch ? parseInt(sizeMatch[1], 10) : 7;
  const rows = sizeMatch ? parseInt(sizeMatch[2], 10) : 7;
  const distanceKm = distanceMatch ? parseFloat(distanceMatch[1]) : 1;

  return { cols, rows, distanceKm };
}

export function generateGridPoints(
  centerLat: number,
  centerLng: number,
  config: GridConfig
): GridPoint[] {
  const points: GridPoint[] = [];

  // Convert km to approximate degrees
  const latKmPerDegree = 111;
  const latDelta = (config.distanceKm / latKmPerDegree) / Math.max(1, config.rows - 1);
  const lngDelta =
    (config.distanceKm / (latKmPerDegree * Math.cos((centerLat * Math.PI) / 180))) /
    Math.max(1, config.cols - 1);

  const startLat = centerLat - (latDelta * (config.rows - 1)) / 2;
  const startLng = centerLng - (lngDelta * (config.cols - 1)) / 2;

  let index = 0;
  for (let i = 0; i < config.rows; i++) {
    for (let j = 0; j < config.cols; j++) {
      points.push({
        index: index++,
        lat: startLat + i * latDelta,
        lng: startLng + j * lngDelta,
      });
    }
  }

  return points;
}

export async function getRankingAtPoint(
  point: GridPoint,
  searchQuery: string,
  targetPlaceId: string
): Promise<RankingResult> {
  // Perform nearby search at this point
  const places = await nearbySearch(
    { lat: point.lat, lng: point.lng },
    searchQuery,
    5000 // 5km radius
  );

  const rankings = places.map((place, index) => ({
    rank: index + 1,
    place,
  }));

  const targetRank = rankings.findIndex((r) => r.place.placeId === targetPlaceId) + 1;

  return {
    point,
    targetRank: targetRank > 0 ? targetRank : 21, // 21 means not in top 20
    rankings,
  };
}

export async function performFullScan(
  businessLocation: { lat: number; lng: number; placeId: string },
  searchQuery: string,
  gridSize: string,
  onProgress?: (current: number, total: number) => void
): Promise<RankingResult[]> {
  const config = parseGridSize(gridSize);
  const points = generateGridPoints(
    businessLocation.lat,
    businessLocation.lng,
    config
  );

  const results: RankingResult[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    try {
      const result = await getRankingAtPoint(
        point,
        searchQuery,
        businessLocation.placeId
      );
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, points.length);
      }

      // Rate limiting: wait 200ms between requests
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error scanning point ${i}:`, error);
      // Continue with next point
    }
  }

  return results;
}
```

#### 5.2 Scan Execution API

```typescript
// app/api/scans/[id]/execute/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { scans, scanResults, competitorRankings, scanSummaries, businesses } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { performFullScan } from '@/lib/services/ranking';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scanId = params.id;

    // Get scan details
    const scan = await db.query.scans.findFirst({
      where: and(eq(scans.id, scanId), eq(scans.userId, userId)),
      with: {
        business: true,
      },
    });

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    if (scan.status === 'running') {
      return NextResponse.json(
        { error: 'Scan is already running' },
        { status: 400 }
      );
    }

    // Update scan status
    await db
      .update(scans)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(scans.id, scanId));

    // Perform the scan in the background (use queue in production)
    performScanInBackground(scanId, scan);

    return NextResponse.json({
      message: 'Scan started',
      scanId
    });
  } catch (error) {
    console.error('Scan execution error:', error);
    return NextResponse.json(
      { error: 'Failed to start scan' },
      { status: 500 }
    );
  }
}

async function performScanInBackground(scanId: string, scan: any) {
  try {
    const results = await performFullScan(
      {
        lat: parseFloat(scan.business.latitude),
        lng: parseFloat(scan.business.longitude),
        placeId: scan.business.placeId,
      },
      scan.searchQuery,
      scan.gridSize
    );

    // Save results to database
    for (const result of results) {
      const scanResult = await db
        .insert(scanResults)
        .values({
          scanId,
          pointIndex: result.point.index,
          latitude: result.point.lat.toString(),
          longitude: result.point.lng.toString(),
          rank: result.targetRank,
        })
        .returning();

      // Save competitor rankings
      for (const ranking of result.rankings) {
        await db.insert(competitorRankings).values({
          scanResultId: scanResult[0].id,
          competitorName: ranking.place.name,
          competitorAddress: ranking.place.address,
          competitorPlaceId: ranking.place.placeId,
          rank: ranking.rank,
          latitude: ranking.place.latitude.toString(),
          longitude: ranking.place.longitude.toString(),
        });
      }
    }

    // Calculate and save summary
    const totalRank = results.reduce(
      (sum, r) => sum + (r.targetRank > 20 ? 21 : r.targetRank),
      0
    );
    const top3Count = results.filter((r) => r.targetRank <= 3).length;
    const top10Count = results.filter((r) => r.targetRank <= 10).length;

    await db.insert(scanSummaries).values({
      scanId,
      averageRank: (totalRank / results.length).toFixed(2),
      top3Percentage: ((top3Count / results.length) * 100).toFixed(2),
      top10Percentage: ((top10Count / results.length) * 100).toFixed(2),
      totalPoints: results.length,
    });

    // Update scan status
    await db
      .update(scans)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(scans.id, scanId));
  } catch (error) {
    console.error('Background scan error:', error);
    await db
      .update(scans)
      .set({ status: 'failed' })
      .where(eq(scans.id, scanId));
  }
}
```

---

### Phase 6: Gemini AI Integration (Week 4)

#### 6.1 Server-Side Gemini Service

```typescript
// lib/services/gemini.ts
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface InsightResponse {
  content: string;
  sources: GroundingSource[];
}

function extractSources(response: GenerateContentResponse): GroundingSource[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!chunks) return [];

  return chunks
    .map((chunk: any) => {
      if (chunk.web && chunk.web.uri) {
        return { uri: chunk.web.uri, title: chunk.web.title || '' };
      }
      if (chunk.maps && chunk.maps.uri) {
        return { uri: chunk.maps.uri, title: chunk.maps.title || '' };
      }
      return null;
    })
    .filter((source): source is GroundingSource => source !== null);
}

export async function generateRankingInsights(
  businessName: string,
  searchQuery: string,
  scanSummary: {
    averageRank: number;
    top3: number;
    top10: number;
  },
  samplePoints: Array<{ lat: number; lng: number; rank: number }>
): Promise<InsightResponse> {
  const prompt = `
As a local SEO expert, analyze the following local search ranking scan results for the business "${businessName}" (a ${searchQuery}) and provide actionable insights.

**Scan Summary:**
- Average Rank: ${scanSummary.averageRank.toFixed(1)}
- In Top 3: ${scanSummary.top3.toFixed(0)}% of locations
- In Top 10: ${scanSummary.top10.toFixed(0)}% of locations

**Sample Ranking Data:**
${samplePoints.map(p => `- At (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}), rank: ${p.rank > 20 ? '20+' : p.rank}`).join('\n')}

**Your Task:**
Provide 3-4 concise, actionable insights to improve local rankings. Focus on what the data suggests. Format using markdown with headings.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  return {
    content: response.text,
    sources: extractSources(response),
  };
}

export async function generateCompetitorAnalysis(
  businessName: string,
  searchQuery: string,
  location: { lat: number; lng: number }
): Promise<InsightResponse> {
  const prompt = `
As a local SEO expert, perform a competitor gap analysis for "${businessName}" (a ${searchQuery}).
Using Google Search and Maps data, identify strategies that top-ranking businesses use.

Provide 2-3 actionable recommendations in these areas:
- Google Business Profile optimization
- Local content strategy
- Local link building opportunities

Format using markdown with headings.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {}, googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: location.lat,
            longitude: location.lng,
          },
        },
      },
    },
  });

  return {
    content: response.text,
    sources: extractSources(response),
  };
}
```

#### 6.2 Insights API Routes

```typescript
// app/api/insights/ranking/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { scans, scanResults, scanSummaries, insights } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateRankingInsights } from '@/lib/services/gemini';
import { z } from 'zod';

const requestSchema = z.object({
  scanId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { scanId } = requestSchema.parse(body);

    // Check if insight already exists
    const existingInsight = await db.query.insights.findFirst({
      where: and(
        eq(insights.scanId, scanId),
        eq(insights.insightType, 'ranking')
      ),
    });

    if (existingInsight) {
      return NextResponse.json(existingInsight);
    }

    // Get scan data
    const scan = await db.query.scans.findFirst({
      where: and(eq(scans.id, scanId), eq(scans.userId, userId)),
      with: {
        business: true,
        summary: true,
        results: {
          limit: 20,
        },
      },
    });

    if (!scan || !scan.summary) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // Generate insights
    const insightData = await generateRankingInsights(
      scan.business.name,
      scan.searchQuery,
      {
        averageRank: parseFloat(scan.summary.averageRank),
        top3: parseFloat(scan.summary.top3Percentage),
        top10: parseFloat(scan.summary.top10Percentage),
      },
      scan.results.map(r => ({
        lat: parseFloat(r.latitude),
        lng: parseFloat(r.longitude),
        rank: r.rank,
      }))
    );

    // Save to database
    const [newInsight] = await db
      .insert(insights)
      .values({
        scanId,
        insightType: 'ranking',
        content: insightData.content,
        sources: insightData.sources,
      })
      .returning();

    return NextResponse.json(newInsight);
  } catch (error) {
    console.error('Ranking insights error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
```

---

### Phase 7: Frontend Implementation (Week 5)

#### 7.1 Dashboard Page

```typescript
// app/(dashboard)/page.tsx
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db/client';
import { scans, businesses } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { RecentScans } from '@/components/dashboard/RecentScans';
import { QuickActions } from '@/components/dashboard/QuickActions';

export default async function DashboardPage() {
  const { userId } = auth();

  const [userBusinesses, recentScans] = await Promise.all([
    db.query.businesses.findMany({
      where: eq(businesses.userId, userId!),
      limit: 10,
    }),
    db.query.scans.findMany({
      where: eq(scans.userId, userId!),
      orderBy: [desc(scans.createdAt)],
      limit: 5,
      with: {
        business: true,
        summary: true,
      },
    }),
  ]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <DashboardStats scans={recentScans} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <RecentScans scans={recentScans} />
        <QuickActions businesses={userBusinesses} />
      </div>
    </div>
  );
}
```

#### 7.2 New Scan Page

```typescript
// app/(dashboard)/scans/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScanConfigForm } from '@/components/scans/ScanConfigForm';
import { useToast } from '@/hooks/use-toast';

export default function NewScanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateScan = async (data: {
    businessId: string;
    searchQuery: string;
    gridSize: string;
  }) => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to create scan');

      const scan = await response.json();

      // Start the scan
      await fetch(`/api/scans/${scan.id}/execute`, {
        method: 'POST',
      });

      toast({
        title: 'Scan started',
        description: 'Your ranking scan is now running.',
      });

      router.push(`/scans/${scan.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create scan',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-3xl font-bold mb-8">New Ranking Scan</h1>
      <ScanConfigForm onSubmit={handleCreateScan} isLoading={isCreating} />
    </div>
  );
}
```

#### 7.3 Scan Results Page with Real-Time Updates

```typescript
// app/(dashboard)/scans/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MapDisplay } from '@/components/maps/MapDisplay';
import { ScanSummary } from '@/components/scans/ScanSummary';
import { InsightsPanels } from '@/components/insights/InsightsPanels';
import { useQuery } from '@tanstack/react-query';

export default function ScanDetailPage() {
  const params = useParams();
  const scanId = params.id as string;

  const { data: scan, refetch } = useQuery({
    queryKey: ['scan', scanId],
    queryFn: async () => {
      const res = await fetch(`/api/scans/${scanId}`);
      if (!res.ok) throw new Error('Failed to fetch scan');
      return res.json();
    },
    refetchInterval: (data) => {
      // Poll every 3 seconds if scan is running
      return data?.status === 'running' ? 3000 : false;
    },
  });

  if (!scan) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold">{scan.business.name}</h1>
        <p className="text-gray-600">{scan.searchQuery}</p>
      </div>

      <div className="flex-1 flex">
        <div className="w-1/3 border-r overflow-auto">
          <ScanSummary scan={scan} />
          <InsightsPanels scanId={scanId} />
        </div>

        <div className="flex-1">
          <MapDisplay
            results={scan.results || []}
            businessLocation={scan.business}
            showHeatmap
          />
        </div>
      </div>
    </div>
  );
}
```

---

### Phase 8: Performance & Optimization (Week 6)

#### 8.1 Implement React Query for Caching

```typescript
// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
}
```

#### 8.2 Database Query Optimization

```typescript
// Use indexes and proper joins
const scansWithData = await db.query.scans.findMany({
  where: eq(scans.userId, userId),
  orderBy: [desc(scans.createdAt)],
  limit: 20,
  with: {
    business: true,
    summary: true,
    results: {
      limit: 100,
      with: {
        competitorRankings: {
          where: eq(competitorRankings.rank, 1),
        },
      },
    },
  },
});
```

#### 8.3 Implement Server Actions for Mutations

```typescript
// lib/actions/scans.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db/client';
import { scans } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';

export async function deleteScan(scanId: string) {
  const { userId } = auth();
  if (!userId) throw new Error('Unauthorized');

  await db
    .delete(scans)
    .where(and(eq(scans.id, scanId), eq(scans.userId, userId)));

  revalidatePath('/scans');
  return { success: true };
}
```

---

### Phase 9: Production Features (Week 6-7)

#### 9.1 Scheduled Scans (Cron Jobs)

```typescript
// app/api/cron/scheduled-scans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { scheduledScans, scans } from '@/lib/db/schema';
import { lte, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find due scheduled scans
    const dueScans = await db.query.scheduledScans.findMany({
      where: and(
        lte(scheduledScans.nextRun, new Date()),
        eq(scheduledScans.isActive, true)
      ),
      with: {
        business: true,
      },
    });

    for (const scheduled of dueScans) {
      // Create new scan
      const [newScan] = await db
        .insert(scans)
        .values({
          userId: scheduled.userId,
          businessId: scheduled.businessId,
          searchQuery: scheduled.searchQuery,
          gridSize: scheduled.gridSize,
          // ... other fields
        })
        .returning();

      // Trigger scan execution
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/scans/${newScan.id}/execute`, {
        method: 'POST',
      });

      // Update next run time
      const nextRun = calculateNextRun(scheduled.frequency);
      await db
        .update(scheduledScans)
        .set({ nextRun })
        .where(eq(scheduledScans.id, scheduled.id));
    }

    return NextResponse.json({
      processed: dueScans.length,
    });
  } catch (error) {
    console.error('Scheduled scans error:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled scans' },
      { status: 500 }
    );
  }
}

function calculateNextRun(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.setMonth(now.getMonth() + 1));
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}
```

#### 9.2 Email Notifications

```typescript
// lib/services/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendScanCompleteEmail(
  to: string,
  scanData: {
    businessName: string;
    averageRank: number;
    top3Percentage: number;
    scanUrl: string;
  }
) {
  await resend.emails.send({
    from: 'GMB Rank Tracker <noreply@yourdomain.com>',
    to,
    subject: `Scan Complete: ${scanData.businessName}`,
    html: `
      <h1>Your ranking scan is complete!</h1>
      <p>Business: ${scanData.businessName}</p>
      <p>Average Rank: ${scanData.averageRank.toFixed(1)}</p>
      <p>Top 3 Visibility: ${scanData.top3Percentage.toFixed(0)}%</p>
      <a href="${scanData.scanUrl}">View Full Results</a>
    `,
  });
}
```

#### 9.3 Export Functionality

```typescript
// app/api/scans/[id]/export/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { scans } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scan = await db.query.scans.findFirst({
      where: and(eq(scans.id, params.id), eq(scans.userId, userId)),
      with: {
        business: true,
        results: {
          with: {
            competitorRankings: true,
          },
        },
        summary: true,
      },
    });

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // Convert to CSV
    const csvRows = [
      ['Point', 'Latitude', 'Longitude', 'Rank'],
      ...scan.results.map(r => [
        r.pointIndex,
        r.latitude,
        r.longitude,
        r.rank,
      ]),
    ];

    const csv = csvRows.map(row => row.join(',')).join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="scan-${scan.id}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export scan' },
      { status: 500 }
    );
  }
}
```

---

## Security Considerations

### Environment Variables
```
✓ Never commit .env.local
✓ Use different API keys for dev/prod
✓ Rotate API keys regularly
✓ Use Vercel environment variables for production
```

### API Security
```typescript
// Rate limiting with Upstash Redis
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function middleware(req: NextRequest) {
  const ip = req.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  return NextResponse.next();
}
```

### Data Validation
```typescript
// Always use Zod for input validation
import { z } from 'zod';

const scanSchema = z.object({
  businessId: z.string().min(1),
  searchQuery: z.string().min(1).max(100),
  gridSize: z.string().regex(/^\d+ x \d+ \(\d+(\.\d+)? km\)$/),
});
```

---

## Testing Strategy

### Unit Tests
```typescript
// __tests__/lib/services/ranking.test.ts
import { parseGridSize, generateGridPoints } from '@/lib/services/ranking';

describe('Ranking Service', () => {
  it('should parse grid size correctly', () => {
    const result = parseGridSize('15 x 11 (4 km)');
    expect(result).toEqual({ cols: 15, rows: 11, distanceKm: 4 });
  });

  it('should generate correct number of grid points', () => {
    const points = generateGridPoints(37.7749, -122.4194, {
      cols: 3,
      rows: 3,
      distanceKm: 1,
    });
    expect(points).toHaveLength(9);
  });
});
```

### Integration Tests
```typescript
// __tests__/api/scans.test.ts
import { POST } from '@/app/api/scans/route';
import { auth } from '@clerk/nextjs/server';

jest.mock('@clerk/nextjs/server');

describe('Scans API', () => {
  it('should create a new scan', async () => {
    (auth as jest.Mock).mockReturnValue({ userId: 'user_123' });

    const req = new Request('http://localhost/api/scans', {
      method: 'POST',
      body: JSON.stringify({
        businessId: 'biz_123',
        searchQuery: 'barber',
        gridSize: '7 x 7 (2 km)',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
  });
});
```

---

## Deployment Pipeline

### Vercel Configuration
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["sfo1"],
  "env": {
    "DATABASE_URL": "@database-url",
    "GEMINI_API_KEY": "@gemini-api-key",
    "GOOGLE_MAPS_API_KEY": "@google-maps-api-key"
  },
  "crons": [
    {
      "path": "/api/cron/scheduled-scans",
      "schedule": "0 * * * *"
    }
  ]
}
```

### GitHub Actions CI/CD
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

---

## Migration Checklist

- [ ] **Phase 1:** Next.js project setup
- [ ] **Phase 2:** Clerk authentication integration
- [ ] **Phase 3:** Neon database setup and migrations
- [ ] **Phase 4:** Google Places API integration
- [ ] **Phase 5:** Real ranking data collection
- [ ] **Phase 6:** Gemini AI insights (server-side)
- [ ] **Phase 7:** Frontend components migration
- [ ] **Phase 8:** Performance optimization
- [ ] **Phase 9:** Production features (cron, email, export)
- [ ] **Testing:** Unit and integration tests
- [ ] **Deployment:** Vercel production deployment

---

## Next Steps

1. **Start with Phase 1:** Set up the Next.js project structure
2. **Configure Clerk:** Set up authentication and user management
3. **Setup Neon:** Create database and run migrations
4. **Migrate Components:** Convert existing React components to Next.js
5. **Implement APIs:** Build server-side API routes
6. **Test Thoroughly:** Write and run tests
7. **Deploy:** Push to production on Vercel

---

**Estimated Timeline:** 6-7 weeks for full implementation
**Team Size:** 1-2 developers
**Cost Estimates:**
- Clerk: Free tier (up to 10k MAU)
- Neon: Free tier (3 GB storage)
- Vercel: Free tier (hobby)
- Google APIs: Pay-as-you-go
- Gemini AI: Pay-as-you-go

---

## Questions & Support

For implementation questions, refer to:
- Next.js Docs: https://nextjs.org/docs
- Clerk Docs: https://clerk.com/docs
- Neon Docs: https://neon.com/docs
- Google Maps API: https://developers.google.com/maps
- Gemini AI: https://ai.google.dev/docs
