/**
 * API Token Endpoint
 * Generates JWT tokens for API authentication using jose
 */

import { auth } from '@/auth';
import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('JWT_SECRET is not configured');
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'JWT configuration missing' },
        { status: 500 }
      );
    }

    // Create a JWT token for API authentication
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({
      sub: session.user.id || session.user.email,
      email: session.user.email,
      name: session.user.name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
