import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from '@/context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
};

export default function LoginScreen() {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const isProcessingRef = useRef(false);

  const redirectUri = useMemo(() => AuthSession.makeRedirectUri(), []);

  const googleClientId = useMemo(() => {
    return (
      Platform.select({
        ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
        web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      }) ||
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      ''
    );
  }, []);

  const authConfig = useMemo(
    () => ({
      clientId: googleClientId,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
    }),
    [googleClientId, redirectUri],
  );

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    authConfig,
    discovery,
  );

  const processAuthResult = useCallback(
    async (result: AuthSession.AuthSessionResult) => {
      if (!result) return;

      if (result.type === 'cancel' || result.type === 'dismiss') {
        Alert.alert('Sign-In Cancelled', 'Google sign-in was cancelled.');
        return;
      }

      if (result.type === 'error') {
        Alert.alert(
          'Google Sign-In Failed',
          result.error?.message || 'An error occurred during Google sign-in.',
        );
        return;
      }

      if (result.type === 'success') {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
          const accessToken =
            result.authentication?.accessToken ?? result.params?.access_token;
          const idToken = result.params?.id_token;

          let googleUser: {
            id: string;
            email: string;
            name: string | null;
            photo: string | null;
          } | null = null;

          if (accessToken) {
            try {
              const res = await fetch(
                'https://www.googleapis.com/userinfo/v2/me',
                {
                  headers: { Authorization: `Bearer ${accessToken}` },
                },
              );
              if (res.ok) {
                const data = await res.json();
                googleUser = {
                  id: data.id ? String(data.id) : `google_${Date.now()}`,
                  email: data.email,
                  name: data.name ?? data.given_name ?? null,
                  photo: data.picture ?? null,
                };
              }
            } catch (fetchErr) {
              console.warn('Error fetching Google user info:', fetchErr);
            }
          }

          if (!googleUser && idToken) {
            try {
              const base64Url = idToken.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(
                atob(base64)
                  .split('')
                  .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join(''),
              );
              const data = JSON.parse(jsonPayload);
              if (data?.email) {
                googleUser = {
                  id: data.sub ? String(data.sub) : `google_${Date.now()}`,
                  email: data.email,
                  name: data.name ?? null,
                  photo: data.picture ?? null,
                };
              }
            } catch (jwtErr) {
              console.warn('Error decoding Google ID token:', jwtErr);
            }
          }

          if (!googleUser || !googleUser.email) {
            Alert.alert(
              'Google Sign-In Failed',
              'Unable to retrieve user information from Google.',
            );
            return;
          }

          await loginWithGoogle({
            id: googleUser.id,
            email: googleUser.email,
            name: googleUser.name,
            photo: googleUser.photo,
          });

          router.replace('/home');
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
          Alert.alert('Google Sign-In Failed', message);
        } finally {
          isProcessingRef.current = false;
        }
      }
    },
    [loginWithGoogle],
  );

  useEffect(() => {
    if (__DEV__) {
      console.log('[Google Auth] Client ID:', googleClientId);
      console.log('[Google Auth] Redirect URI:', redirectUri);
    }
  }, [googleClientId, redirectUri]);

  useEffect(() => {
    if (response) {
      processAuthResult(response);
    }
  }, [processAuthResult, response]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }

    try {
      await login(email, password);
      router.replace('/home');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to login.';
      Alert.alert('Login Failed', message);
    }
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoading) {
      return;
    }

    if (!googleClientId) {
      Alert.alert(
        'Google OAuth Required',
        'Please configure EXPO_PUBLIC_GOOGLE_CLIENT_ID or EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in your environment variables.',
      );
      return;
    }

    if (!request) {
      Alert.alert(
        'Please Wait',
        'Google sign-in is initializing. Please try again in a moment.',
      );
      return;
    }

    setIsGoogleLoading(true);

    try {
      const result = await promptAsync();
      await processAuthResult(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sign in with Google.';
      Alert.alert('Google Sign-In Failed', message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
        <Text style={styles.title}>RealEstate</Text>
        <Text style={styles.subtitle}>Login to your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </Pressable>

        <View style={styles.separatorContainer}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>OR</Text>
          <View style={styles.separatorLine} />
        </View>

        <Pressable
          style={styles.googleButton}
          onPress={handleGoogleLogin}
          disabled={isGoogleLoading}>
          {isGoogleLoading ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : (
            <Text style={styles.googleButtonText}>Login with Google</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/register')}>
          <Text style={styles.link}>Don&apos;t have an account? Register</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 14,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e5e5',
  },
  separatorText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 15,
  },
});

