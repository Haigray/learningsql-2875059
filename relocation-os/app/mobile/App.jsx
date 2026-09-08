import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';

import { PlanProvider, usePlan } from './src/PlanContext';
import { useSyncNotifications } from './src/notifications/register';
import TodayScreen from './src/screens/TodayScreen';
import TimelineScreen from './src/screens/TimelineScreen';
import DocumentsScreen from './src/screens/DocumentsScreen';
import CompareScreen from './src/screens/CompareScreen';
import GuideScreen from './src/screens/GuideScreen';
import SetupScreen from './src/screens/SetupScreen';

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Emoji rather than an icon dependency: fewer moving parts for a shell.
const icon = ch => ({ tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>{ch}</Text> });

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}>
      <Tabs.Screen name="Today" component={TodayScreen} options={icon('◉')} />
      <Tabs.Screen name="Plan" component={TimelineScreen} options={icon('☰')} />
      <Tabs.Screen name="Documents" component={DocumentsScreen} options={icon('⧉')} />
      <Tabs.Screen name="Compare" component={CompareScreen} options={icon('⇄')} />
      <Tabs.Screen name="Guide" component={GuideScreen} options={icon('◫')} />
    </Tabs.Navigator>
  );
}

function Root() {
  const { hydrated, plan } = usePlan();
  useSyncNotifications();                 // keeps the OS schedule in step with the plan
  if (!hydrated) return null;             // avoids a flash of the empty state
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {plan ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Setup" component={SetupScreen} options={{ presentation: 'modal' }} />
        </>
      ) : (
        <Stack.Screen name="Setup" component={SetupScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const scheme = useColorScheme();
  return (
    <PlanProvider>
      <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        <Root />
      </NavigationContainer>
    </PlanProvider>
  );
}
