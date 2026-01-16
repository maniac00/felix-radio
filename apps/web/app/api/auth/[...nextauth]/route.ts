/**
 * NextAuth.js API Route Handler
 * Handles all /api/auth/* requests
 */

import { handlers } from '@/auth';

export const { GET, POST } = handlers;

export const runtime = 'edge';
