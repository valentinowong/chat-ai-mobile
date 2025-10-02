import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="chat/[id]"
              options={{
                headerShown: true,
                headerTintColor: '#FFFFFF',
                headerStyle: { backgroundColor: '#0F172A', elevation: 0, shadowOpacity: 0, borderBottomWidth: 0 },
                headerTitleStyle: { fontSize: 16, fontWeight: '600' },
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: '#F3F4F6', paddingTop: 0 },
                headerTransparent: true,
              }}
            />
          </Stack>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
