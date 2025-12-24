/**
 * Example utility functions for platform login
 * Use these in your frontend applications
 */

import { Platform, PlatformLoginRequest, PlatformLoginResponse } from '@/types';

/**
 * Login to Dashboard (Web)
 * Only for internal staff
 */
export async function loginDashboard(
  credentials: PlatformLoginRequest
): Promise<PlatformLoginResponse> {
  const response = await fetch('/api/auth/login/dashboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Login failed');
  }

  return data;
}

/**
 * Login to Mobile App
 * For both internal staff and external customers
 */
export async function loginMobile(
  credentials: PlatformLoginRequest
): Promise<PlatformLoginResponse> {
  const response = await fetch('/api/auth/login/mobile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Login failed');
  }

  return data;
}

/**
 * Generic platform login
 */
export async function loginPlatform(
  platform: Platform,
  credentials: PlatformLoginRequest
): Promise<PlatformLoginResponse> {
  const endpoint =
    platform === 'dashboard'
      ? '/api/auth/login/dashboard'
      : '/api/auth/login/mobile';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Login failed');
  }

  return data;
}

/**
 * Example usage in a React component:
 *
 * const handleDashboardLogin = async (e: FormEvent) => {
 *   e.preventDefault();
 *   try {
 *     const result = await loginDashboard({
 *       email: email,
 *       password: password,
 *     });
 *
 *     // Store user info
 *     localStorage.setItem('user', JSON.stringify(result.user));
 *
 *     // Redirect to dashboard
 *     router.push('/dashboard');
 *   } catch (error) {
 *     setError(error.message);
 *   }
 * };
 *
 * const handleMobileLogin = async (e: FormEvent) => {
 *   e.preventDefault();
 *   try {
 *     const result = await loginMobile({
 *       email: email,
 *       password: password,
 *     });
 *
 *     // Store user info
 *     await AsyncStorage.setItem('user', JSON.stringify(result.user));
 *
 *     // Navigate to home
 *     navigation.navigate('Home');
 *   } catch (error) {
 *     Alert.alert('Login Failed', error.message);
 *   }
 * };
 */
