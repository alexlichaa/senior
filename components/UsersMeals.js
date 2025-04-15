import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,  // Switch from ScrollView to FlatList
  Image,
  ActivityIndicator,
  ImageBackground,  // Added ImageBackground
} from 'react-native';
import firebase from 'firebase';

const UsersMeals = () => {
  const [allUserMeals, setAllUserMeals] = useState([]);
  const [loadingMeals, setLoadingMeals] = useState(true);

  useEffect(() => {
    const fetchAllUserMeals = async () => {
      try {
        const usersSnapshot = await firebase
          .firestore()
          .collection('USERSinfo')
          .get();
        const fetchMealsPromises = usersSnapshot.docs.map(async (userDoc) => {
          try {
            const userMealsSnapshot = await firebase
              .firestore()
              .collection('USERSinfo')
              .doc(userDoc.id)
              .collection('Meals')
              .get();

            return userMealsSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
          } catch (error) {
            console.error(
              `Error fetching meals for user ${userDoc.id}:`,
              error
            );
            return [];
          }
        });

        const mealsArray = await Promise.all(fetchMealsPromises);
        const allMeals = mealsArray.flat();
        setAllUserMeals(allMeals);
      } catch (error) {
        console.error('Error fetching meals from all users:', error);
      } finally {
        setLoadingMeals(false);
      }
    };

    fetchAllUserMeals();
  }, []);

  const renderMealItem = ({ item }) => (
    <View style={styles.mealCard}>
      {item.photo ? (
        <Image 
          source={{ uri: item.photo }} 
          style={styles.mealImage} 
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholderImage}>
          <Text>No Image</Text>
        </View>
      )}
      <Text style={styles.mealName}>{item.name || 'Unnamed Meal'}</Text>
    </View>
  );

  return (
    <ImageBackground
      source={{
        uri: 'https://firebasestorage.googleapis.com/v0/b/travel-companion-1af66.appspot.com/o/AppBackground.jpeg?alt=media&token=ff5e6fc2-e72f-4d8c-a469-633d4b8430bd',
      }}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3 }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Meals from All Users</Text>
        {loadingMeals ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : allUserMeals.length > 0 ? (
          <FlatList
            data={allUserMeals}
            renderItem={renderMealItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.mealsContainer}
          />
        ) : (
          <Text style={styles.noMealsText}>No meals found.</Text>
        )}
      </View>
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
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  mealsContainer: {
    justifyContent: 'space-around',
  },
  mealCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    margin: 8,
    width: '45%',
    
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  mealImage: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    
  },
  placeholderImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#e1e1e1',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  mealName: {
    padding: 10,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  noMealsText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 18,
  },
});

export default UsersMeals;