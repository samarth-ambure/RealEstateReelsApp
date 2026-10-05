import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider, useThemeContext } from '@/context/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedRootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function ThemedRootNavigator() {
  const { colorScheme } = useThemeContext();
  const { isAuthenticated, isLoading } = useAuth();

  const backgroundColor = colorScheme === 'dark' ? '#000000' : '#f6f7f9';

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.rootContainer, { backgroundColor }]}>
      <Stack>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen
            name="index"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="register"
            options={{
              title: 'Create Account',
            }}
          />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen
            name="home"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="property/[id]"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="profile"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="create-property"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="messages"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="notifications"
            options={{
              headerShown: false,
            }}
          />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rootContainer: {
    flex: 1,
  },
});
