// EditPreferences.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  ImageBackground,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import firebase from 'firebase';

const EditPreferences = ({ navigation, route }) => {
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  const [selectedDiet, setSelectedDiet] = useState('');
  const [combinedMeals, setCombinedMeals] = useState([]);
  const [filteredMeals, setFilteredMeals] = useState([]);
  const [finalFilteredMeals, setFinalFilteredMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Cuisines, 2: Diet
  const [initialLoading, setInitialLoading] = useState(true);

  const cuisines = [
    'American',
    'British',
    'French',
    'Italian',
    'Chinese',
    'Indian',
    'Japanese',
  ];

  const diets = [
    'High protein-high carbs',
    'High protein-low carbs',
    'High protein-low sugar',
    'High carbs-low sugar',
    'Low carbs-low sugar',
    'High protein-high carbs-low sugar',
    'High protein-low carbs-low sugar',
  ];

  const dietConditionsMap = {
    'High protein-high carbs': {
      protein_g: (value) => value > 100,
      carbohydrates_total_g: (value) => value > 350,
    },
    'High protein-low carbs': {
      protein_g: (value) => value > 100,
      carbohydrates_total_g: (value) => value < 300,
    },
    'High protein-low sugar': {
      protein_g: (value) => value > 100,
      sugar_g: (value) => value < 75,
    },
    'High carbs-low sugar': {
      carbohydrates_total_g: (value) => value > 350,
      sugar_g: (value) => value < 75,
    },
    'Low carbs-low sugar': {
      carbohydrates_total_g: (value) => value < 300,
      sugar_g: (value) => value < 75,
    },
    'High protein-high carbs-low sugar': {
      protein_g: (value) => value > 100,
      carbohydrates_total_g: (value) => value > 350,
      sugar_g: (value) => value < 75,
    },
    'High protein-low carbs-low sugar': {
      protein_g: (value) => value > 100,
      carbohydrates_total_g: (value) => value < 300,
      sugar_g: (value) => value < 75,
    },
  };

  // Fetch user's current preferences on component mount
  useEffect(() => {
    const fetchUserPreferences = async () => {
      try {
        const user = firebase.auth().currentUser;
        if (!user) {
          Alert.alert('Error', 'User not authenticated');
          navigation.goBack();
          return;
        }

        const userDoc = await firebase
          .firestore()
          .collection('USERSinfo')
          .doc(user.uid)
          .get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          
          // Extract existing preferences if available
          if (userData.cuisinePreferences) {
            setSelectedCuisines(userData.cuisinePreferences);
          }
          
          if (userData.dietPreference) {
            setSelectedDiet(userData.dietPreference);
          }
        }
      } catch (error) {
        console.error('Error fetching user preferences:', error);
        Alert.alert('Error', 'Failed to load your current preferences');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchUserPreferences();
  }, []);

  const handleCuisineSelect = (cuisine) => {
    if (selectedCuisines.includes(cuisine)) {
      setSelectedCuisines(selectedCuisines.filter((item) => item !== cuisine));
    } else if (selectedCuisines.length < 2) {
      setSelectedCuisines([...selectedCuisines, cuisine]);
    }
  };

  const fetchMeals = async (cuisine) => {
    try {
      const response = await fetch(
        `https://www.themealdb.com/api/json/v1/1/filter.php?a=${cuisine}`
      );
      const data = await response.json();
      return data.meals || [];
    } catch (error) {
      console.error(`Error fetching meals for ${cuisine}:`, error);
      return [];
    }
  };

  const fetchMealDetails = async (mealId) => {
    try {
      const response = await fetch(
        `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${mealId}`
      );
      const data = await response.json();
      return data.meals ? data.meals[0] : null;
    } catch (error) {
      console.error(`Error fetching details for meal ID ${mealId}:`, error);
      return null;
    }
  };

  const fetchNutritionData = async (mealDetail) => {
    const ingredients = Array.from({ length: 20 })
      .map((_, index) => {
        const ingredient = mealDetail[`strIngredient${index + 1}`];
        const measure = mealDetail[`strMeasure${index + 1}`];
        return ingredient && measure ? `${measure} ${ingredient}` : null;
      })
      .filter(Boolean)
      .join(', ');

    if (!ingredients) return null;

    try {
      const response = await fetch(
        `https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(
          ingredients
        )}`,
        {
          headers: { 'X-Api-Key': 'P3KS2zRUAhS+RK5r7T42PQ==3O3WWMPRtQzW3tCX' },
        }
      );
      const data = await response.json();
      return calculateTotalRow(data.items || []);
    } catch (error) {
      console.error('Error fetching nutrition data:', error);
      return null;
    }
  };

  const calculateTotalRow = (items) => {
    const total = {
      protein_g: items.reduce((sum, item) => sum + (item.protein_g || 0), 0),
      carbohydrates_total_g: items.reduce(
        (sum, item) => sum + (item.carbohydrates_total_g || 0),
        0
      ),
      sugar_g: items.reduce((sum, item) => sum + (item.sugar_g || 0), 0),
      fat_g: items.reduce((sum, item) => sum + (item.fat_total_g || 0), 0),
    };

    return {
      protein_g: parseFloat(total.protein_g.toFixed(1)),
      carbohydrates_total_g: parseFloat(total.carbohydrates_total_g.toFixed(1)),
      sugar_g: parseFloat(total.sugar_g.toFixed(1)),
      fat_g: parseFloat(total.fat_g.toFixed(1)),
    };
  };

  const handleNext = async () => {
    if (step === 1) {
      if (selectedCuisines.length === 2) {
        setLoading(true);
        try {
          const [meals1, meals2] = await Promise.all(
            selectedCuisines.map((cuisine) => fetchMeals(cuisine))
          );
          const combined = [...meals1, ...meals2];
          setCombinedMeals(combined);
        } catch (error) {
          console.error('Error fetching meals:', error);
        } finally {
          setLoading(false);
          setStep(2); // Move to diet selection
        }
      } else {
        Alert.alert('Please select exactly 2 cuisines');
      }
    } else if (step === 2 && selectedDiet) {
      setLoading(true);
      try {
        const conditions = dietConditionsMap[selectedDiet];
        if (!conditions) {
          console.error('No conditions mapped for the selected diet.');
          Alert.alert('Error', 'Invalid diet selection.');
          return;
        }

        const filtered = [];

        // Process a sample of meals (for quicker processing)
        const sampleMeals = combinedMeals.slice(0, Math.min(15, combinedMeals.length));
        
        for (const meal of sampleMeals) {
          const mealDetail = await fetchMealDetails(meal.idMeal);
          if (!mealDetail) continue;

          const nutritionData = await fetchNutritionData(mealDetail);
          if (!nutritionData) continue;

          // Check all conditions
          let meetsAllConditions = true;
          for (const [key, conditionFn] of Object.entries(conditions)) {
            if (nutritionData[key] === undefined || !conditionFn(nutritionData[key])) {
              meetsAllConditions = false;
              break;
            }
          }

          if (meetsAllConditions) {
            filtered.push({ ...meal, nutritionData });
          }
        }

        setFilteredMeals(filtered);
        setFinalFilteredMeals(filtered);
        
        // Save the preferences
        await savePreferences();
        
      } catch (error) {
        console.error('Error updating preferences:', error);
        Alert.alert('Error', 'Failed to update your preferences');
      } finally {
        setLoading(false);
      }
    }
  };

  const savePreferences = async () => {
    const user = firebase.auth().currentUser;
    if (!user) {
      Alert.alert('Authentication Error', 'User is not authenticated.');
      return false;
    }

    const userId = user.uid;
    const preferencesIds = finalFilteredMeals.map((meal) => meal.idMeal);

    try {
      // Update user profile with new preferences
      await firebase.firestore().collection('USERSinfo').doc(userId).update({
        Preferences: preferencesIds,
        cuisinePreferences: selectedCuisines,
        dietPreference: selectedDiet
      });

      Alert.alert('Success', 'Your preferences have been updated successfully!');
      navigation.goBack();
      return true;
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
      return false;
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={{
        uri: 'https://firebasestorage.googleapis.com/v0/b/travel-companion-1af66.appspot.com/o/AppBackground.jpeg?alt=media&token=ff5e6fc2-e72f-4d8c-a469-633d4b8430bd',
      }}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3 }}>
      <View style={styles.container}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0000ff" />
          </View>
        )}

        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Preferences</Text>
        </View>

        {step === 1 && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>Select 2 Cuisines</Text>
            <Text style={styles.subtitle}>
              Choose the 2 cuisine types you prefer the most.
            </Text>
            {cuisines.map((cuisine) => (
              <TouchableOpacity
                key={cuisine}
                style={[
                  styles.option,
                  selectedCuisines.includes(cuisine) && styles.selectedOption,
                ]}
                onPress={() => handleCuisineSelect(cuisine)}>
                <Text
                  style={[
                    styles.optionText,
                    selectedCuisines.includes(cuisine) &&
                      styles.selectedOptionText,
                  ]}>
                  {cuisine}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.nextButton,
                { opacity: selectedCuisines.length === 2 ? 1 : 0.5 },
              ]}
              onPress={handleNext}
              disabled={selectedCuisines.length !== 2}>
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {step === 2 && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>Select a Diet Preference</Text>
            <Text style={styles.subtitle}>
              Choose the diet type that best matches your nutritional goals.
            </Text>
            {diets.map((diet) => (
              <TouchableOpacity
                key={diet}
                style={[
                  styles.option,
                  selectedDiet === diet && styles.selectedOption,
                ]}
                onPress={() => setSelectedDiet(diet)}>
                <Text
                  style={[
                    styles.optionText,
                    selectedDiet === diet && styles.selectedOptionText,
                  ]}>
                  {diet}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.nextButton, { opacity: selectedDiet ? 1 : 0.5 }]}
              onPress={handleNext}
              disabled={!selectedDiet}>
              <Text style={styles.nextButtonText}>Save Preferences</Text>
            </TouchableOpacity>
          </ScrollView>
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
    padding: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 30, // Offset for the back button to center the title
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  option: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#b5b5b5',
    marginVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  selectedOption: {
    backgroundColor: '#d67c7c',
    borderColor: '#b35959',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedOptionText: {
    color: 'black',
    fontWeight: 'bold',
  },
  nextButton: {
    backgroundColor: 'black',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 20,
    alignSelf: 'center',
    width: 200,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EditPreferences;