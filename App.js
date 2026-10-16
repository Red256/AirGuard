import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AlertsScreen from './src/screens/AlertsScreen';
import FaqScreen from './src/screens/FaqScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import ReadingsScreen from './src/screens/ReadingsScreen';
import SuggestionScreen from './src/screens/SuggestionScreen';
import { AlertsProvider, useAlerts } from './src/state/AlertsContext';
import { SensorProvider } from './src/state/SensorContext';
import { SettingsProvider } from './src/state/SettingsContext';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const AlertsStack = createNativeStackNavigator();

const TAB_ICONS = {
  Home: 'home',
  Alerts: 'notifications',
  Analytics: 'bar-chart',
  FAQ: 'help-circle',
};

// Home is the readings list; tapping a reading that is above its limit opens a suggestion page.
function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <HomeStack.Screen name="Readings" component={ReadingsScreen} />
      <HomeStack.Screen name="Suggestion" component={SuggestionScreen} />
    </HomeStack.Navigator>
  );
}

// Alerts is a list; tapping an alert (current or past) opens its panel, with a back link to the list.
function AlertsStackScreen() {
  return (
    <AlertsStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <AlertsStack.Screen name="AlertsList" component={AlertsScreen} />
      <AlertsStack.Screen name="AlertDetail" component={SuggestionScreen} />
    </AlertsStack.Navigator>
  );
}

function Tabs() {
  const { current } = useAlerts();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#7A8AA0',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: colors.border },
        tabBarIcon: ({ color }) => <Ionicons name={TAB_ICONS[route.name]} size={26} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeStackScreen} />
      <Tab.Screen
        name="Alerts"
        component={AlertsStackScreen}
        options={{
          tabBarBadge: current.length > 0 ? current.length : undefined,
          tabBarBadgeStyle: { backgroundColor: '#E53935', color: '#FFFFFF' },
        }}
      />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="FAQ" component={FaqScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <SensorProvider>
          <AlertsProvider>
            <NavigationContainer>
              <StatusBar style="dark" />
              <Tabs />
            </NavigationContainer>
          </AlertsProvider>
        </SensorProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
