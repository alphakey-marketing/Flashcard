/**
 * Supabase Authentication Module
 * Handles all authentication logic with proper error handling
 */

import { supabase } from '../supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
}

export class SupabaseAuth {
  /**
   * Get current authentication state
   */
  static async getCurrentAuth(): Promise<AuthState> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ [AUTH] Error getting session:', error.message);
        return { user: null, session: null, isAuthenticated: false };
      }

      if (!session || !session.user) {
        console.log('ℹ️ [AUTH] No active session');
        return { user: null, session: null, isAuthenticated: false };
      }

      console.log('✅ [AUTH] Session active:', {
        userId: session.user.id,
        email: session.user.email,
        hasAccessToken: !!session.access_token
      });

      return {
        user: session.user,
        session: session,
        isAuthenticated: true
      };
    } catch (error) {
      console.error('❌ [AUTH] Unexpected error:', error);
      return { user: null, session: null, isAuthenticated: false };
    }
  }

  /**
   * Wait for authentication to be ready
   * Useful on app startup
   */
  static async waitForAuth(maxWaitMs: number = 5000): Promise<AuthState> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const auth = await this.getCurrentAuth();
      if (auth.isAuthenticated) {
        return auth;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('⚠️ [AUTH] Timeout waiting for authentication');
    return { user: null, session: null, isAuthenticated: false };
  }

  /**
   * Ensure user is authenticated, throw if not
   */
  static async ensureAuthenticated(): Promise<{ userId: string; session: Session }> {
    const auth = await this.getCurrentAuth();
    
    if (!auth.isAuthenticated || !auth.session || !auth.user) {
      throw new Error('User not authenticated. Please sign in.');
    }

    return {
      userId: auth.user.id,
      session: auth.session
    };
  }

  /**
   * Get just the user ID (throws if not authenticated)
   */
  static async getUserId(): Promise<string> {
    const { userId } = await this.ensureAuthenticated();
    return userId;
  }

  /**
   * Check if user is authenticated (doesn't throw)
   */
  static async isAuthenticated(): Promise<boolean> {
    const auth = await this.getCurrentAuth();
    return auth.isAuthenticated;
  }
}
