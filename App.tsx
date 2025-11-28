import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { getCurrentLocation, LocationData } from './src/services/location';
import { sendSOSAlert, getContacts, Contact, addContact, deleteContact } from './src/services/sms';
import { initializeFirebase } from './src/services/firebase';
import { startVideoRecording, startAudioRecording, stopRecording, EmergencyDetector } from './src/services/recording';
import { findSafeRoute, getNearbyEmergencyServices } from './src/services/navigation';
import { getARDirections, findNearestSafePlaces, ARDirections } from './src/services/ar-navigation';
import { makeVoiceCall, makeVideoCall, makeEmergencyCall } from './src/services/calling';
import { ARCamera } from './src/components/ARCamera';

function MainApp() {
  const { user, login, signup, logout, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sosLoading, setSosLoading] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '' });
  const [isRecording, setIsRecording] = useState({ video: false, audio: false });
  const [emergencyDetector, setEmergencyDetector] = useState<EmergencyDetector | null>(null);
  const [screamDetectionActive, setScreamDetectionActive] = useState(false);
  const [routeDestination, setRouteDestination] = useState('');
  const [safeRoute, setSafeRoute] = useState<any>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showARCamera, setShowARCamera] = useState(false);
  const [arDirections, setArDirections] = useState<ARDirections | null>(null);

  useEffect(() => {
    initializeFirebase();
    loadLocation();
  }, []);

  useEffect(() => {
    if (user) {
      loadContacts();
    }
  }, [user]);

  const loadLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
    } catch (error) {
      console.log('Using demo location (location permission denied)');
      // Set demo location when permission denied
      setLocation({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now(),
      });
    }
  };

  const loadContacts = async () => {
    if (user) {
      try {
        const userContacts = await getContacts(user.uid);
        setContacts(userContacts);
      } catch (error) {
        console.error('Error loading contacts:', error);
      }
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      if (isSignup) {
        await signup(email, password);
        Alert.alert('Success', 'Account created successfully!');
      } else {
        await login(email, password);
        Alert.alert('Success', 'Logged in successfully!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Authentication failed');
    }
  };

  const handleSOS = async () => {
    if (!user || !location) {
      Alert.alert('Error', 'User not logged in or location not available');
      return;
    }

    setSosLoading(true);
    try {
      const result = await sendSOSAlert(
        user.uid,
        { latitude: location.latitude, longitude: location.longitude },
        'EMERGENCY! I need help immediately!'
      );

      if (result.success) {
        Alert.alert(
          '🚨 SOS Alert Sent!',
          `Emergency message sent to ${result.sentTo.length} contacts:\n\n${result.contacts.map(c => `• ${c.name}: ${c.phone}`).join('\n')}\n\nLocation: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}\n\n${process.env.EXPO_PUBLIC_TEST_MODE === 'true' ? '(Demo Mode - No real SMS sent)' : 'Real SMS alerts sent!'}`
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send SOS alert');
    } finally {
      setSosLoading(false);
    }
  };

  const handleEmergencyCall = async (type: 'voice' | 'video') => {
    try {
      const userContacts = await getContacts(user?.uid || '');
      if (userContacts.length === 0) {
        Alert.alert('No Contacts', 'Please add emergency contacts first');
        return;
      }

      const firstContact = userContacts[0].phone;
      
      if (type === 'voice') {
        await makeVoiceCall(firstContact);
        Alert.alert('📞 Voice Call', `Calling ${userContacts[0].name} at ${firstContact}`);
      } else {
        await makeVideoCall(firstContact);
        Alert.alert('📹 Video Call', `Video calling ${userContacts[0].name} at ${firstContact}`);
      }
    } catch (error) {
      Alert.alert('Call Failed', 'Unable to make call');
      console.error('Call error:', error);
    }
  };

  const renderDashboard = () => (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Safety Dashboard</Text>
        <Text style={styles.status}>
          📍 Location: {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Loading...'}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            🆘 Tap the SOS button to send emergency alert
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.sosButton, sosLoading && styles.sosButtonDisabled]} 
          onPress={handleSOS}
          disabled={sosLoading}
        >
          {sosLoading ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <>
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosSubtext}>Send Emergency Alert</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.callButtonsRow}>
          <TouchableOpacity
            style={[styles.callButton, { backgroundColor: '#4ECDC4' }]}
            onPress={() => handleEmergencyCall('voice')}
          >
            <Text style={styles.callButtonText}>📞 Voice Call</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.callButton, { backgroundColor: '#45B7D1' }]}
            onPress={() => handleEmergencyCall('video')}
          >
            <Text style={styles.callButtonText}>📹 Video Call</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.featureGrid}>
          <TouchableOpacity style={styles.featureCard} onPress={() => setCurrentScreen('contacts')}>
            <Text style={styles.featureIcon}>📱</Text>
            <Text style={styles.featureTitle}>Trusted Contacts</Text>
            <Text style={styles.featureDesc}>Manage emergency contacts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.featureCard} onPress={() => setCurrentScreen('map')}>
            <Text style={styles.featureIcon}>📍</Text>
            <Text style={styles.featureTitle}>Live Location</Text>
            <Text style={styles.featureDesc}>Share your position</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.featureCard} 
            onPress={async () => {
              if (!location) {
                Alert.alert('Error', 'Location not available');
                return;
              }
              try {
                const directions = await getARDirections(location);
                setArDirections(directions);
                setShowARCamera(true);
              } catch (error) {
                Alert.alert('Error', 'Failed to get AR directions');
              }
            }}
          >
            <Text style={styles.featureIcon}>🔮</Text>
            <Text style={styles.featureTitle}>AR Navigation</Text>
            <Text style={styles.featureDesc}>Camera-guided safety</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.featureCard} onPress={() => setCurrentScreen('recording')}>
            <Text style={styles.featureIcon}>🎥</Text>
            <Text style={styles.featureTitle}>Record Evidence</Text>
            <Text style={styles.featureDesc}>Video & audio capture</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️ Safety Note</Text>
          <Text style={styles.warningText}>
            This app contacts ONLY trusted contacts you've added (friends/family). It does NOT contact emergency services.
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderContacts = () => (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentScreen('dashboard')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trusted Contacts</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.contactsList}>
          <Text style={styles.contactsTitle}>Emergency Contacts ({contacts.length})</Text>
          {contacts.length === 0 ? (
            <View style={styles.emptyContacts}>
              <Text style={styles.emptyText}>📞 No emergency contacts added yet</Text>
              <Text style={styles.emptySubtext}>Add trusted friends and family for emergency alerts</Text>
            </View>
          ) : (
            contacts.map((contact) => (
            <View key={contact.id} style={styles.contact}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>👤 {contact.name}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>
              <View style={styles.contactActions}>
                <TouchableOpacity 
                  style={styles.callButton} 
                  onPress={() => {
                    if (typeof window !== 'undefined' && window.open) {
                      window.open(`tel:${contact.phone}`);
                    } else {
                      Alert.alert('Call', `Calling ${contact.name} at ${contact.phone}`);
                    }
                  }}
                >
                  <Text style={styles.callButtonText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={() => {
                    Alert.alert(
                      'Delete Contact',
                      `Remove ${contact.name} from emergency contacts?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Delete', 
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              if (user && contact.id) {
                                await deleteContact(contact.id, user.uid);
                                loadContacts();
                                Alert.alert('Deleted', `${contact.name} removed from contacts`);
                              }
                            } catch (error) {
                              Alert.alert('Error', 'Failed to delete contact');
                            }
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
          )}
        </View>

        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddContact(true)}>
          <Text style={styles.addButtonText}>+ Add New Contact</Text>
        </TouchableOpacity>

        {showAddContact && (
          <View style={styles.addContactForm}>
            <Text style={styles.formTitle}>Add Emergency Contact</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={newContact.name}
              onChangeText={(text) => setNewContact({...newContact, name: text})}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number (+1234567890)"
              value={newContact.phone}
              onChangeText={(text) => setNewContact({...newContact, phone: text})}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              value={newContact.email}
              onChangeText={(text) => setNewContact({...newContact, email: text})}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.formButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => {
                  setShowAddContact(false);
                  setNewContact({ name: '', phone: '', email: '' });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={async () => {
                  if (!newContact.name || !newContact.phone) {
                    Alert.alert('Error', 'Name and phone are required');
                    return;
                  }
                  if (!user) {
                    Alert.alert('Error', 'User not logged in');
                    return;
                  }
                  try {
                    await addContact({
                      name: newContact.name,
                      phone: newContact.phone,
                      email: newContact.email,
                      userId: user.uid,
                    });
                    Alert.alert('Success', `${newContact.name} has been added to your emergency contacts!`);
                    setShowAddContact(false);
                    setNewContact({ name: '', phone: '', email: '' });
                    loadContacts(); // Refresh contacts
                  } catch (error) {
                    Alert.alert('Error', 'Failed to add contact');
                  }
                }}
              >
                <Text style={styles.saveButtonText}>Save Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ⚠️ Only add trusted friends and family. Emergency numbers (112, 911, etc.) are blocked for safety.
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderMap = () => (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentScreen('dashboard')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Location</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapText}>🗺️</Text>
          <Text style={styles.mapTitle}>Live Location Map</Text>
          <Text style={styles.mapDesc}>
            Your current location: {location ? 'Live GPS' : 'Loading...'}
          </Text>
          <Text style={styles.coordinates}>
            {location ? `Lat: ${location.latitude.toFixed(4)}, Lng: ${location.longitude.toFixed(4)}` : 'Getting location...'}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.shareButton} 
          onPress={async () => {
            if (!user || !location) {
              Alert.alert('Error', 'Location not available');
              return;
            }
            
            try {
              const contacts = await getContacts(user.uid);
              if (contacts.length === 0) {
                Alert.alert('Error', 'No contacts to share with. Add emergency contacts first.');
                return;
              }
              
              const locationUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
              const message = `I'm sharing my live location with you for safety:\n\n${locationUrl}\n\nSent from Women's Safety App`;
              
              // Send location to all contacts
              const result = await sendSOSAlert(user.uid, location, message);
              
              if (result.success) {
                Alert.alert(
                  '📤 Location Shared!', 
                  `Your location has been shared with ${result.contacts.length} contacts:\n\n${result.contacts.map(c => `• ${c.name}`).join('\n')}\n\nLocation: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                );
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to share location');
            }
          }}
        >
          <Text style={styles.shareButtonText}>📤 Share Live Location</Text>
        </TouchableOpacity>

        <View style={styles.locationFeatures}>
          <Text style={styles.featuresTitle}>Location Features:</Text>
          <Text style={styles.feature}>• Real-time GPS tracking</Text>
          <Text style={styles.feature}>• Share with trusted contacts</Text>
          <Text style={styles.feature}>• Location history</Text>
          <Text style={styles.feature}>• Geofencing alerts</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderRecording = () => (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentScreen('dashboard')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Evidence Recording</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.recordingSection}>
          <Text style={styles.sectionTitle}>🎥 Video Recording</Text>
          <TouchableOpacity 
            style={[styles.recordButton, isRecording.video && styles.recordingActive]} 
            onPress={async () => {
              if (isRecording.video) {
                const result = await stopRecording();
                setIsRecording({...isRecording, video: false});
                Alert.alert('Recording Stopped', `Video saved (${result.duration}s). Evidence stored securely.`);
              } else {
                await startVideoRecording();
                setIsRecording({...isRecording, video: true});
                Alert.alert('Recording Started', 'Video recording in progress. Tap again to stop.');
              }
            }}
          >
            <Text style={styles.recordButtonText}>
              {isRecording.video ? '⏹️ Stop Video' : '● Start Video Recording'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recordingSection}>
          <Text style={styles.sectionTitle}>🎤 Audio Recording</Text>
          <TouchableOpacity 
            style={[styles.recordButton, isRecording.audio && styles.recordingActive]} 
            onPress={async () => {
              if (isRecording.audio) {
                const result = await stopRecording();
                setIsRecording({...isRecording, audio: false});
                Alert.alert('Recording Stopped', `Audio saved (${result.duration}s). Evidence stored securely.`);
              } else {
                await startAudioRecording();
                setIsRecording({...isRecording, audio: true});
                Alert.alert('Recording Started', 'Audio recording in progress. Tap again to stop.');
              }
            }}
          >
            <Text style={styles.recordButtonText}>
              {isRecording.audio ? '⏹️ Stop Audio' : '● Start Audio Recording'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recordingSection}>
          <Text style={styles.sectionTitle}>🔊 Scream Detection</Text>
          <TouchableOpacity 
            style={[styles.toggleButton, screamDetectionActive && styles.toggleActive]} 
            onPress={async () => {
              if (screamDetectionActive) {
                emergencyDetector?.stop();
                setScreamDetectionActive(false);
                Alert.alert('Emergency Detection', 'Auto-detection disabled.');
              } else {
                try {
                  const detector = new EmergencyDetector(async () => {
                    console.log('🚨 EMERGENCY DETECTED - AUTO TRIGGERING SOS!');
                    Alert.alert(
                      '🚨 EMERGENCY DETECTED!', 
                      'Emergency scream or "help" detected!\nAuto-sending SOS in 5 seconds...\nTap Cancel to stop.',
                      [
                        { 
                          text: 'Cancel', 
                          style: 'cancel',
                          onPress: () => console.log('Emergency SOS cancelled by user')
                        }
                      ]
                    );
                    
                    // Auto-trigger SOS after 5 seconds (more time to cancel)
                    setTimeout(() => {
                      handleSOS();
                    }, 5000);
                  });
                  await detector.start();
                  setEmergencyDetector(detector);
                  setScreamDetectionActive(true);
                  Alert.alert('Emergency Detection', 'Auto-detection enabled.\nListening for screams and words like "help", "emergency", "danger".');
                } catch (error) {
                  Alert.alert('Error', 'Could not access microphone for emergency detection.');
                }
              }
            }}
          >
            <Text style={styles.toggleButtonText}>
              {screamDetectionActive ? 'Disable Emergency Detection' : 'Enable Emergency Detection'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.featureDesc}>Automatically triggers SOS on loud sounds</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            📱 Recordings are stored securely and can be shared with authorities if needed.
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderSafeRoute = () => (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentScreen('dashboard')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safe Route Navigation</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.routeSection}>
          <Text style={styles.sectionTitle}>🗺️ Route Planning</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Enter destination" 
            value={routeDestination}
            onChangeText={setRouteDestination}
          />
          <TouchableOpacity 
            style={[styles.routeButton, routeLoading && styles.buttonDisabled]} 
            onPress={async () => {
              if (!routeDestination.trim()) {
                Alert.alert('Error', 'Please enter a destination first.');
                return;
              }
              if (!location) {
                Alert.alert('Error', 'Location not available.');
                return;
              }
              
              setRouteLoading(true);
              try {
                const route = await findSafeRoute(
                  { lat: location.latitude, lng: location.longitude },
                  routeDestination
                );
                setSafeRoute(route);
                Alert.alert(
                  'Safe Route Found!',
                  `Distance: ${route.distance}\nDuration: ${route.duration}\nSafety Score: ${route.safetyScore}/100\n\nRoute optimized for safety with well-lit paths.`
                );
              } catch (error) {
                Alert.alert('Error', 'Failed to calculate safe route.');
              } finally {
                setRouteLoading(false);
              }
            }}
            disabled={routeLoading}
          >
            {routeLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.routeButtonText}>Find Safe Route</Text>
            )}
          </TouchableOpacity>
        </View>

        {safeRoute && (
          <View style={styles.routeResults}>
            <Text style={styles.routeTitle}>🗺️ Safe Route Found</Text>
            <Text style={styles.routeInfo}>Distance: {safeRoute.distance} | Duration: {safeRoute.duration}</Text>
            <Text style={styles.safetyScore}>Safety Score: {safeRoute.safetyScore}/100</Text>
            
            <View style={styles.arNavigation}>
              <Text style={styles.arTitle}>🔮 AR Navigation Preview</Text>
              <View style={styles.arView}>
                <Text style={styles.arDirection}>⬆️</Text>
                <Text style={styles.arInstruction}>Head North on Main St</Text>
                <Text style={styles.arDistance}>300m ahead</Text>
                <View style={styles.arIndicators}>
                  <Text style={styles.arSafety}>🟢 Safe Zone</Text>
                  <Text style={styles.arLighting}>💡 Well Lit</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.routeSteps}>
              <Text style={styles.stepsTitle}>Route Steps:</Text>
              {safeRoute.steps.slice(0, 3).map((step: any, index: number) => (
                <View key={index} style={styles.routeStep}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepInstruction}>{step.instruction}</Text>
                    <Text style={styles.stepDistance}>{step.distance}</Text>
                  </View>
                  <Text style={styles.stepSafety}>
                    {step.safetyLevel === 'high' ? '🟢' : step.safetyLevel === 'medium' ? '🟡' : '🔴'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.safetyFeatures}>
          <Text style={styles.featuresTitle}>Safety Features:</Text>
          <Text style={styles.feature}>• Well-lit paths preferred</Text>
          <Text style={styles.feature}>• Avoid isolated areas</Text>
          <Text style={styles.feature}>• Police station locations</Text>
          <Text style={styles.feature}>• Public transport options</Text>
          <Text style={styles.feature}>• Real-time safety alerts</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            🛡️ Routes are optimized for safety, considering lighting, foot traffic, and emergency services proximity.
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Women's Safety App</Text>
        <Text style={styles.subtitle}>Login to Continue</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <TouchableOpacity 
          style={[styles.button, authLoading && styles.buttonDisabled]} 
          onPress={handleAuth}
          disabled={authLoading}
        >
          {authLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isSignup ? 'Sign Up' : 'Login'}</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setIsSignup(!isSignup)} disabled={authLoading}>
          <Text style={styles.toggleText}>
            {isSignup ? 'Already have account? Login' : 'Need account? Sign Up'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.note}>Enter any email/password to demo</Text>
      </View>
    );
  }

  if (showARCamera) {
    return (
      <ARCamera 
        directions={arDirections}
        currentLocation={location}
        onClose={() => {
          setShowARCamera(false);
          setArDirections(null);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      {currentScreen === 'dashboard' && renderDashboard()}
      {currentScreen === 'contacts' && renderContacts()}
      {currentScreen === 'map' && renderMap()}
      {currentScreen === 'recording' && renderRecording()}
      {currentScreen === 'saferoute' && renderSafeRoute()}
      
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navButton, currentScreen === 'dashboard' && styles.activeNav]} 
          onPress={() => setCurrentScreen('dashboard')}
        >
          <Text style={styles.navText}>🏠 Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navButton, currentScreen === 'contacts' && styles.activeNav]} 
          onPress={() => setCurrentScreen('contacts')}
        >
          <Text style={styles.navText}>📱 Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={logout}
        >
          <Text style={styles.navText}>🚪 Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: '#e74c3c',
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  backButton: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  status: {
    color: '#ecf0f1',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#34495e',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    color: '#7f8c8d',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
  infoBox: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  infoText: {
    color: '#856404',
    fontSize: 14,
  },
  sosButton: {
    backgroundColor: '#e74c3c',
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  sosText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  sosSubtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  featureDesc: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 4,
    textAlign: 'center',
  },
  contactsList: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  contactsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  contact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  contactName: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
  },
  contactPhone: {
    fontSize: 14,
    color: '#7f8c8d',
    flex: 1,
  },
  callButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  addButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapPlaceholder: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 200,
    justifyContent: 'center',
  },
  mapText: {
    fontSize: 64,
    marginBottom: 10,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  mapDesc: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  coordinates: {
    fontSize: 12,
    color: '#95a5a6',
  },
  shareButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  locationFeatures: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  feature: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 5,
  },
  recordingSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  recordButton: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    backgroundColor: '#27ae60',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  routeSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  routeButton: {
    backgroundColor: '#9b59b6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  routeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  safetyFeatures: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningBox: {
    backgroundColor: '#f8d7da',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 5,
  },
  warningText: {
    color: '#721c24',
    fontSize: 12,
    lineHeight: 18,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  navButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  activeNav: {
    backgroundColor: '#e74c3c',
  },
  navText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  toggleText: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 15,
  },
  sosButtonDisabled: {
    opacity: 0.6,
  },
  addContactForm: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#3498db',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    padding: 12,
    borderRadius: 6,
    flex: 0.45,
  },
  cancelButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    padding: 12,
    borderRadius: 6,
    flex: 0.45,
  },
  saveButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 12,
  },
  emptyContacts: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#95a5a6',
    textAlign: 'center',
  },
  recordingActive: {
    backgroundColor: '#e74c3c',
  },
  toggleActive: {
    backgroundColor: '#e74c3c',
  },
  routeResults: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#27ae60',
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 8,
  },
  routeInfo: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 4,
  },
  safetyScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 15,
  },
  arNavigation: {
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 16,
    marginBottom: 15,
  },
  arTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  arView: {
    alignItems: 'center',
  },
  arDirection: {
    fontSize: 48,
    color: '#00ff00',
    marginBottom: 8,
  },
  arInstruction: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  arDistance: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 10,
  },
  arIndicators: {
    flexDirection: 'row',
    gap: 10,
  },
  arSafety: {
    color: '#00ff00',
    fontSize: 12,
  },
  arLighting: {
    color: '#ffff00',
    fontSize: 12,
  },
  routeSteps: {
    marginTop: 10,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  stepNumber: {
    backgroundColor: '#3498db',
    color: '#fff',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 10,
  },
  stepContent: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 14,
    color: '#2c3e50',
  },
  stepDistance: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  stepSafety: {
    fontSize: 16,
  },
  callButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  callButton: {
    flex: 0.48,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  callButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}