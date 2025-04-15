import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ImageBackground,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import firebase from '../firebaseconfig';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: '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', // Replace with your actual API key
  dangerouslyAllowBrowser: true  // Required for client-side usage
});

// Your Assistant ID from OpenAI
const ASSISTANT_ID = 'asst_Ksyvub9VfBA8HjpNRLZRXxXN'; // Replace with your Assistant ID

const ChatBox = ({ navigation }) => {
  const [messages, setMessages] = useState([
    // Include initial welcome message directly in state to avoid Firestore write
    {
      id: 'welcome-message',
      text: "Hello! I'm your recipe assistant. Ask me about recipes, cooking techniques, or ingredients, and I'll help you find what you're looking for!",
      userId: 'assistant',
      username: 'Recipe Assistant',
      userProfilePhoto: 'https://firebasestorage.googleapis.com/v0/b/travel-companion-1af66.appspot.com/o/RecipeAppLogo.jpg?alt=media&token=ce30dd7c-21af-4308-8a98-3da9219c1407',
      timestamp: new Date().toISOString(),
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('Anonymous');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [isBotTyping, setBotTyping] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const flatListRef = useRef(null);
  const firestoreUnsubscribe = useRef(null);
  const [isFirestoreEnabled, setIsFirestoreEnabled] = useState(true);

  useEffect(() => {
    const user = firebase.auth().currentUser;
    if (!user) {
      navigation.navigate('Login');
      return;
    }

    // Fetch user data once (simplified)
    fetchUserData(user.uid);
    
    // Try to set up Firestore, but have a fallback for Snack environment
    try {
      setupMessagesListener();
    } catch (error) {
      console.warn('Firestore listener setup failed, using local state only:', error);
      setIsFirestoreEnabled(false);
      setLoading(false);
    }
    
    // Create a thread for OpenAI Assistant
    createThread();

    // Clean up the listener and other resources on component unmount
    return () => {
      // Clean up Firestore listener
      if (firestoreUnsubscribe.current) {
        try {
          firestoreUnsubscribe.current();
        } catch (error) {
          console.warn('Error cleaning up Firestore listener:', error);
        }
      }
    };
  }, [navigation]);

  // Fetch user data just once
  const fetchUserData = async (userId) => {
    try {
      const userDoc = await firebase
        .firestore()
        .collection('USERSinfo')
        .doc(userId)
        .get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        setUsername(userData.username || 'Anonymous');
        setProfilePhoto(userData.profilePhoto || null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Set up messages listener separately
  const setupMessagesListener = () => {
    try {
      // Clear any existing listener first
      if (firestoreUnsubscribe.current) {
        firestoreUnsubscribe.current();
      }
      
      // Create new listener with proper error handling
      firestoreUnsubscribe.current = firebase
        .firestore()
        .collection('ChatMessages')
        .orderBy('timestamp', 'asc')
        .limit(50) // Limit to reasonable number to prevent overloading
        .onSnapshot(
          // Success handler
          (snapshot) => {
            const messagesData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              // Convert Firestore timestamp to ISO string for consistent formatting
              timestamp: doc.data().timestamp ? doc.data().timestamp.toDate().toISOString() : new Date().toISOString()
            }));
            
            // Only update state if we have messages from Firestore
            if (messagesData.length > 0) {
              setMessages(messagesData);
            }
            
            setLoading(false);
            
            // Scroll to bottom on new messages (with delay to ensure render)
            if (flatListRef.current && messagesData.length > 0) {
              setTimeout(() => {
                flatListRef.current.scrollToEnd({ animated: true });
              }, 300);
            }
          },
          // Error handler
          (error) => {
            console.error('Firestore listener error:', error);
            setIsFirestoreEnabled(false); // Disable Firestore if there's an error
            setLoading(false);
          }
        );
    } catch (error) {
      console.error('Error setting up message listener:', error);
      setIsFirestoreEnabled(false); // Disable Firestore if there's an error
      setLoading(false);
    }
  };

  // Create a new thread for the conversation
  const createThread = async () => {
    try {
      console.log('Creating thread...');
      setLoading(true);
      
      const thread = await openai.beta.threads.create();
      console.log('Thread created:', thread.id);
      setThreadId(thread.id);
      
      setLoading(false);
    } catch (error) {
      console.error('Error creating thread:', error);
      setLoading(false);
      Alert.alert(
        'Connection Error', 
        'Failed to initialize the recipe assistant. Please try again later.'
      );
    }
  };

  // Add a message to either Firestore or local state
  const addMessage = async (messageData) => {
    try {
      if (isFirestoreEnabled) {
        // Try to add to Firestore
        await firebase.firestore().collection('ChatMessages').add({
          ...messageData,
          // Convert ISO string date to Firestore timestamp if it's a string
          timestamp: typeof messageData.timestamp === 'string' 
            ? firebase.firestore.Timestamp.fromDate(new Date(messageData.timestamp))
            : messageData.timestamp
        });
      } else {
        // If Firestore is disabled, just update local state
        const newMessageWithId = {
          ...messageData,
          id: 'local-' + Date.now() + Math.random().toString(36).substring(2, 10)
        };
        
        setMessages(prevMessages => [...prevMessages, newMessageWithId]);
        
        // Scroll to bottom after adding message
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 300);
      }
      return true;
    } catch (error) {
      console.error('Error adding message:', error);
      
      // If Firestore fails, fallback to local state
      if (isFirestoreEnabled) {
        setIsFirestoreEnabled(false);
        console.log('Switching to local state for messages due to Firestore error');
        
        const newMessageWithId = {
          ...messageData,
          id: 'local-' + Date.now() + Math.random().toString(36).substring(2, 10)
        };
        
        setMessages(prevMessages => [...prevMessages, newMessageWithId]);
      }
      
      return false;
    }
  };

  // Send a message to the OpenAI Assistant
  const sendMessageToAssistant = async (userMessage) => {
    if (!threadId) {
      console.error('No thread ID available - creating new thread');
      await createThread();
      
      if (!threadId) {
        Alert.alert('Error', 'Could not create conversation thread. Please try again.');
        return;
      }
    }

    setBotTyping(true);

    try {
      // Add a message to the thread
      console.log('Adding message to thread:', threadId);
      await openai.beta.threads.messages.create(
        threadId,
        {
          role: "user",
          content: userMessage
        }
      );

      // Create a run with the assistant
      console.log('Starting run with assistant:', ASSISTANT_ID);
      const run = await openai.beta.threads.runs.create(
        threadId,
        {
          assistant_id: ASSISTANT_ID
        }
      );

      // Poll for run completion with timeout
      await waitForRunCompletion(run.id);
      
      // Get the assistant's response
      await getAssistantResponse();
      
    } catch (error) {
      console.error('Error sending message to assistant:', error.message);
      setBotTyping(false);
      
      // Add error message to chat
      await addMessage({
        text: "Sorry, I'm having trouble connecting to the recipe service. Please try again later.",
        userId: 'assistant',
        username: 'Recipe Assistant',
        userProfilePhoto: 'https://firebasestorage.googleapis.com/v0/b/travel-companion-1af66.appspot.com/o/RecipeAppLogo.jpg?alt=media&token=ce30dd7c-21af-4308-8a98-3da9219c1407',
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Wait for the run to complete with better error handling
  const waitForRunCompletion = async (runId) => {
    console.log('Waiting for run completion:', runId);
    let completed = false;
    let attempts = 0;
    const maxAttempts = 15; // Reduced for faster timeout (15 seconds)
    
    while (!completed && attempts < maxAttempts) {
      attempts++;
      
      try {
        const runStatus = await openai.beta.threads.runs.retrieve(
          threadId,
          runId
        );
        
        console.log('Run status:', runStatus.status);
        
        if (runStatus.status === 'completed') {
          completed = true;
        } else if (runStatus.status === 'requires_action') {
          // Handle tool calls if needed
          await handleToolCalls(runStatus, runId);
        } else if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
          throw new Error(`Run ended with status: ${runStatus.status}`);
        } else {
          // Wait before checking again
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Error checking run status:', error);
        throw error;
      }
    }
    
    if (!completed) {
      throw new Error('Timeout waiting for assistant response');
    }
  };

  // Handle tool calls from the assistant
  const handleToolCalls = async (runStatus, runId) => {
    const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
    const toolOutputs = [];
    
    for (const toolCall of toolCalls) {
      const { id, function: { name, arguments: args } } = toolCall;
      const parsedArgs = JSON.parse(args);
      let output = null;
      
      try {
        // Call the appropriate API based on the tool function
        switch (name) {
          case 'searchMealsByCategory':
            output = await searchMealsByCategory(parsedArgs.category);
            break;
          case 'searchMealsByIngredient':
            output = await searchMealsByIngredient(parsedArgs.ingredient);
            break;
          case 'getMealDetails':
            output = await getMealDetails(parsedArgs.mealId);
            break;
          case 'getRandomMeal':
            output = await getRandomMeal();
            break;
          case 'getMealCategories':
            output = await getMealCategories();
            break;
          default:
            output = { error: `Unknown function: ${name}` };
        }
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        output = { error: `Failed to execute ${name}: ${error.message}` };
      }
      
      toolOutputs.push({
        tool_call_id: id,
        output: JSON.stringify(output)
      });
    }
    
    // Submit the tool outputs back to the assistant
    await openai.beta.threads.runs.submitToolOutputs(
      threadId,
      runId,
      {
        tool_outputs: toolOutputs
      }
    );
  };

  // Tool functions for fetching recipe data
  const searchMealsByCategory = async (category) => {
    const response = await fetch(
      `https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`
    );
    return response.json();
  };
  
  const searchMealsByIngredient = async (ingredient) => {
    const response = await fetch(
      `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredient)}`
    );
    return response.json();
  };
  
  const getMealDetails = async (mealId) => {
    const response = await fetch(
      `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${mealId}`
    );
    return response.json();
  };
  
  const getRandomMeal = async () => {
    const response = await fetch(
      'https://www.themealdb.com/api/json/v1/1/random.php'
    );
    return response.json();
  };
  
  const getMealCategories = async () => {
    const response = await fetch(
      'https://www.themealdb.com/api/json/v1/1/categories.php'
    );
    return response.json();
  };

  // Get the assistant's response
  const getAssistantResponse = async () => {
    try {
      console.log('Getting assistant response...');
      const messagesResponse = await openai.beta.threads.messages.list(
        threadId,
        { order: 'desc', limit: 1 }
      );
      
      // Get the assistant's latest message
      const assistantMessages = messagesResponse.data.filter(msg => msg.role === 'assistant');
      
      if (assistantMessages.length > 0) {
        const latestMessage = assistantMessages[0];
        
        // Combine all text content parts
        let messageText = '';
        for (const contentPart of latestMessage.content) {
          if (contentPart.type === 'text') {
            messageText += contentPart.text.value;
          }
        }
        
        // Avoid empty messages
        if (!messageText.trim()) {
          messageText = "I'm not sure how to respond to that. Could you please try asking something about recipes or cooking?";
        }
        
        // Add assistant message
        await addMessage({
          text: messageText,
          userId: 'assistant',
          username: 'Recipe Assistant',
          userProfilePhoto: 'https://firebasestorage.googleapis.com/v0/b/travel-companion-1af66.appspot.com/o/RecipeAppLogo.jpg?alt=media&token=ce30dd7c-21af-4308-8a98-3da9219c1407',
          timestamp: new Date().toISOString(),
        });
      } else {
        console.warn('No assistant messages found');
        
        // Add fallback message if no response was found
        await addMessage({
          text: "I'm having trouble generating a response right now. Let's try again with a different question about recipes?",
          userId: 'assistant',
          username: 'Recipe Assistant',
          userProfilePhoto: 'https://firebasestorage.googleapis.com/v0/b/travel-companion-1af66.appspot.com/o/RecipeAppLogo.jpg?alt=media&token=ce30dd7c-21af-4308-8a98-3da9219c1407',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error getting assistant response:', error);
      throw error;
    } finally {
      setBotTyping(false);
    }
  };

  // Handle sending a user message
  const handleSend = async () => {
    if (newMessage.trim() === '') return;

    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
      // Message data
      const userMessageData = {
        text: newMessage,
        userId: user.uid,
        username: username,
        userProfilePhoto: profilePhoto,
        timestamp: new Date().toISOString(),
      };
      
      // Add to Firestore or local state
      await addMessage(userMessageData);
      
      // Save message before clearing input
      const messageText = newMessage;
      
      // Clear input
      setNewMessage('');
      
      // Send to assistant
      await sendMessageToAssistant(messageText);
      
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  // Helper function to format message timestamp
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    let date;
    // Handle different timestamp formats
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      // Firestore timestamp
      date = timestamp.toDate();
    } else {
      // Regular Date object
      date = new Date(timestamp);
    }
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render a chat message
  const renderMessage = ({ item }) => {
    const isCurrentUser = item.userId === firebase.auth().currentUser?.uid;
    const isAssistant = item.userId === 'assistant';
    const messageTime = formatMessageTime(item.timestamp);

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && (
          <Image 
            source={{ uri: item.userProfilePhoto || 'https://firebasestorage.googleapis.com/v0/b/travel-companion-1af66.appspot.com/o/noprofile.jpg?alt=media&token=ec31ea3a-27e9-4621-9d43-fe55b086caa0' }} 
            style={styles.userAvatar} 
          />
        )}
        <View style={styles.messageContent}>
          {!isCurrentUser && (
            <Text style={[styles.username, isAssistant && styles.assistantUsername]}>
              {item.username}
            </Text>
          )}
          <View style={[
            styles.messageBubble,
            isCurrentUser ? styles.currentUserBubble : 
            isAssistant ? styles.assistantBubble : styles.otherUserBubble
          ]}>
            <Text style={[
              styles.messageText,
              isCurrentUser ? styles.currentUserText : 
              isAssistant ? styles.assistantText : styles.otherUserText
            ]}>
              {item.text}
            </Text>
          </View>
          <Text style={styles.messageTime}>{messageTime}</Text>
        </View>
        {isCurrentUser && (
          <Image 
            source={{ uri: item.userProfilePhoto || 'https://firebasestorage.googleapis.com/v0/b/travel-companion-1af66.appspot.com/o/noprofile.jpg?alt=media&token=ec31ea3a-27e9-4621-9d43-fe55b086caa0' }} 
            style={styles.userAvatar} 
          />
        )}
      </View>
    );
  };

  const handleBackPress = () => {
    navigation.navigate('Main');
  };

  return (
    <ImageBackground
      source={{
        uri: 'https://firebasestorage.googleapis.com/v0/b/travel-companion-1af66.appspot.com/o/AppBackground.jpeg?alt=media&token=ff5e6fc2-e72f-4d8c-a469-633d4b8430bd',
      }}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Let's Cook Chat</Text>
          {!isFirestoreEnabled && (
            <Text style={styles.offlineIndicator}>Offline Mode</Text>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.loadingText}>Setting up your chat...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => 
              flatListRef.current.scrollToEnd({ animated: true })
            }
          />
        )}

        {isBotTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>Recipe Assistant is typing...</Text>
          </View>
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={100}
          style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Ask about recipes..."
            placeholderTextColor="#888"
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, (isBotTyping || loading) && styles.disabledButton]}
            onPress={handleSend}
            disabled={isBotTyping || loading}>
            <FontAwesome name="send" size={20} color="white" />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    marginTop: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: 'black',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
    flex: 1,
  },
  offlineIndicator: {
    color: '#FF6347',
    fontSize: 12,
    fontStyle: 'italic',
    marginRight: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#0000ff',
  },
  messagesContainer: {
    padding: 10,
    paddingBottom: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 5,
    alignItems: 'flex-end',
  },
  currentUserMessage: {
    justifyContent: 'flex-end',
  },
  otherUserMessage: {
    justifyContent: 'flex-start',
  },
  userAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    marginHorizontal: 5,
  },
  messageContent: {
    maxWidth: '70%',
  },
  username: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 3,
    color: '#333',
  },
  assistantUsername: {
    color: '#2E8B57', // Sea green for the assistant
  },
  messageBubble: {
    padding: 10,
    borderRadius: 15,
    maxWidth: '100%',
  },
  currentUserBubble: {
    backgroundColor: '#d67c7c',
    borderBottomRightRadius: 0,
  },
  otherUserBubble: {
    backgroundColor: '#e8e8e8',
    borderBottomLeftRadius: 0,
  },
  assistantBubble: {
    backgroundColor: '#E6F5F0', // Light green background for the assistant
    borderBottomLeftRadius: 0,
    borderWidth: 1,
    borderColor: '#2E8B57',
  },
  messageText: {
    fontSize: 16,
  },
  currentUserText: {
    color: 'white',
  },
  otherUserText: {
    color: 'black',
  },
  assistantText: {
    color: '#2E8B57', // Sea green text for the assistant
  },
  messageTime: {
    fontSize: 10,
    color: '#888',
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#d67c7c',
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    alignSelf: 'flex-end',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  typingIndicator: {
    padding: 10,
    backgroundColor: 'rgba(230, 245, 240, 0.8)',
    borderRadius: 20,
    marginHorizontal: 10,
    marginBottom: 5,
  },
  typingText: {
    color: '#2E8B57',
    fontStyle: 'italic',
  },
});

export default ChatBox;