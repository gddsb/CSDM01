import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from '../screens/LoginScreen';
import BottomTabs from './BottomTabs';
import WorkStartScreen from '../screens/WorkStartScreen';
import WorkReportScreen from '../screens/WorkReportScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import QualityScreen from '../screens/QualityScreen';
import QueryScreen from '../screens/QueryScreen';
import ProfileScreen from '../screens/ProfileScreen';

import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/ui';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={BottomTabs} />
            <Stack.Screen name="WorkStart" component={WorkStartScreen} />
            <Stack.Screen name="WorkReport" component={WorkReportScreen} />
            <Stack.Screen name="Maintenance" component={MaintenanceScreen} />
            <Stack.Screen name="Quality" component={QualityScreen} />
            <Stack.Screen name="Query" component={QueryScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
