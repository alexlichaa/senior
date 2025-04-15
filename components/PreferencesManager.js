// Preferences.js  only handle BMI calculation during signup
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ImageBackground,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
  Alert, // For user feedback
} 
  from 'react-native';
import { ProgressCircle } from 'react-native-svg-charts'; // A library for circular charts
import { Picker } from '@react-native-picker/picker';
import firebase from 'firebase';

const Preferences = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bmiDetails, setBmiDetails] = useState({
    weight: '',
    weightUnit: 'Kg',
    height: '',
    heightUnit: 'cm',
    feet: '',
    inches: '',
  });
  const [bmi, setBmi] = useState(0);

  const handleNext = async () => {
    if (step === 1) {
      // Calculate BMI
      const weightInKg =
        bmiDetails.weightUnit === 'Kg'
          ? parseFloat(bmiDetails.weight)
          : parseFloat(bmiDetails.weight) * 0.453592;

      const heightInMeters =
        bmiDetails.heightUnit === 'cm'
          ? parseFloat(bmiDetails.height) / 100
          : parseFloat(bmiDetails.feet) / 3.281 +
            parseFloat(bmiDetails.inches) / 39.37;

      if (heightInMeters === 0 || isNaN(heightInMeters)) {
        setBmi(0);
        Alert.alert('Invalid Input', 'Height cannot be zero or invalid.');
        return;
      }

      const calculatedBmi = weightInKg / (heightInMeters * heightInMeters);
      const roundedBmi = parseFloat(calculatedBmi.toFixed(1));
      setBmi(roundedBmi);
      console.log(`Calculated BMI: ${roundedBmi}`);

      // Proceed to BMI Results
      setStep(2);
    }
  };

  const handleDone = async () => {
    // Save BMI to Firestore
    const user = firebase.auth().currentUser;

    if (!user) {
      Alert.alert('Authentication Error', 'User is not authenticated.');
      return;
    }

    setLoading(true);

    try {
      // Update the user's BMI in Firestore
      await firebase.firestore().collection('USERSinfo').doc(user.uid).update({
        bmi: bmi,
        bmiLastUpdated: new Date().toISOString(),
      });

      console.log('BMI successfully saved to Firestore:', bmi);
      Alert.alert('Success', 'Your BMI has been saved. You can update your cuisine preferences anytime from the app!');
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      console.error('Error saving BMI to Firestore:', error);
      Alert.alert(
        'Firestore Error',
        'There was an error saving your BMI.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={{
        uri: 'https://firebasestorage.googleapis.com/v0/b/travel-companion-1af66.appspot.com/o/AppWallpaper.jpeg?alt=media&token=dc34798b-82ec-40ed-85ec-84a1655cf70f',
      }}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3 }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#0000ff" />
            </View>
          )}
          {step === 1 && (
            <ScrollView>
              <Text style={styles.title}>BMI Calculator</Text>
              {/* Weight Section */}
              <Text style={styles.subtitle}>Weight</Text>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter weight"
                  keyboardType="numeric"
                  value={bmiDetails.weight}
                  onChangeText={(value) =>
                    setBmiDetails({ ...bmiDetails, weight: value })
                  }
                />
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={bmiDetails.weightUnit}
                    onValueChange={(value) =>
                      setBmiDetails({ ...bmiDetails, weightUnit: value })
                    }>
                    <Picker.Item label="Kg" value="Kg" />
                    <Picker.Item label="lbs" value="lbs" />
                  </Picker>
                </View>
              </View>
              {/* Height Section */}
              <Text style={styles.subtitle}>Height</Text>
              <View style={styles.row}>
                {bmiDetails.heightUnit === 'cm' && (
                  <TextInput
                    style={styles.input}
                    placeholder="Enter height in cm"
                    keyboardType="numeric"
                    value={bmiDetails.height}
                    onChangeText={(value) =>
                      setBmiDetails({ ...bmiDetails, height: value })
                    }
                  />
                )}
                {bmiDetails.heightUnit === 'feet+inches' && (
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      placeholder="Feet"
                      keyboardType="numeric"
                      value={bmiDetails.feet}
                      onChangeText={(value) =>
                        setBmiDetails({ ...bmiDetails, feet: value })
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Inches"
                      keyboardType="numeric"
                      value={bmiDetails.inches}
                      onChangeText={(value) =>
                        setBmiDetails({ ...bmiDetails, inches: value })
                      }
                    />
                  </View>
                )}
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={bmiDetails.heightUnit}
                    onValueChange={(value) =>
                      setBmiDetails({ ...bmiDetails, heightUnit: value })
                    }>
                    <Picker.Item label="cm" value="cm" />
                    <Picker.Item label="feet" value="feet+inches" />
                  </Picker>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  {
                    opacity:
                      bmiDetails.weight &&
                      (bmiDetails.height ||
                        (bmiDetails.feet && bmiDetails.inches))
                        ? 1
                        : 0.5,
                  },
                ]}
                onPress={handleNext}
                disabled={
                  !bmiDetails.weight ||
                  (!bmiDetails.height && bmiDetails.heightUnit === 'cm') ||
                  (bmiDetails.heightUnit === 'feet+inches' &&
                    (!bmiDetails.feet || !bmiDetails.inches))
                }>
                <Text style={styles.nextButtonText}>Calculate BMI</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
          {step === 2 && (
            <ScrollView>
              <Text style={styles.bmiResultsTitle}>BMI Results</Text>
              <Text style={styles.subtitle}>Your BMI is:</Text>
              <View style={styles.resultBox}>
                <Text style={styles.bmiText}>{bmi}</Text>
              </View>

              <Text style={styles.subtitle}>BMI Diagram:</Text>
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}>
                <ProgressCircle
                  style={{ height: 200, width: 200 }}
                  progress={Math.min(bmi / 40, 1)}
                  progressColor={
                    bmi < 18.5
                      ? 'blue'
                      : bmi < 25
                      ? 'green'
                      : bmi < 30
                      ? '#B8860B'
                      : bmi < 35
                      ? 'orange'
                      : bmi < 40
                      ? 'red'
                      : 'darkred'
                  }
                />
                <Text
                  style={{
                    position: 'absolute',
                    fontSize: 20,
                    fontWeight: 'bold',
                    color:
                      bmi < 18.5
                        ? 'blue'
                        : bmi < 25
                        ? 'green'
                        : bmi < 30
                        ? '#B8860B'
                        : bmi < 35
                        ? 'orange'
                        : bmi < 40
                        ? 'red'
                        : 'darkred',
                  }}>
                  {bmi < 18.5
                    ? 'Underweight'
                    : bmi < 25
                    ? 'Normal'
                    : bmi < 30
                    ? 'Overweight'
                    : bmi < 35
                    ? 'Obese I'
                    : bmi < 40
                    ? 'Obese II'
                    : 'Obese III'}
                </Text>
              </View>

              {/* Legend */}
              <View style={styles.legendContainer}>
                <View style={styles.legendRow}>
                  <View
                    style={[styles.legendColorBox, { backgroundColor: 'blue' }]}
                  />
                  <Text>Underweight (BMI {'<'} 18.5)</Text>
                </View>
                <View style={styles.legendRow}>
                  <View
                    style={[
                      styles.legendColorBox,
                      { backgroundColor: 'green' },
                    ]}
                  />
                  <Text>Normal (BMI range: 18.5 - 25)</Text>
                </View>
                <View style={styles.legendRow}>
                  <View
                    style={[
                      styles.legendColorBox,
                      { backgroundColor: '#B8860B' },
                    ]}
                  />
                  <Text>Overweight (BMI range: 25 - 30)</Text>
                </View>
                <View style={styles.legendRow}>
                  <View
                    style={[
                      styles.legendColorBox,
                      { backgroundColor: 'orange' },
                    ]}
                  />
                  <Text>Obese I (BMI range: 30 - 35)</Text>
                </View>
                <View style={styles.legendRow}>
                  <View
                    style={[styles.legendColorBox, { backgroundColor: 'red' }]}
                  />
                  <Text>Obese II (BMI range: 35 - 40)</Text>
                </View>
                <View style={styles.legendRow}>
                  <View
                    style={[
                      styles.legendColorBox,
                      { backgroundColor: 'darkred' },
                    ]}
                  />
                  <Text>Obese III (BMI {'≥'} 40)</Text>
                </View>
              </View>

              <Text style={styles.infoText}>
                After creating your account, you can set your cuisine preferences from the main menu.
              </Text>

              <TouchableOpacity style={styles.nextButton} onPress={handleDone}>
                <Text style={styles.nextButtonText}>Complete Setup</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </TouchableWithoutFeedback>
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
    justifyContent: 'center',
    paddingTop: 50, // Add this to lower the content on the page
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    marginTop: 20, // Adjusted to lower the title
  },

  bmiResultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'left',
    marginTop: 40, // Adjusted to lower the title
  },

  nextButton: {
    backgroundColor: 'black',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 10,
    width: 150, // Set a smaller fixed width
    alignSelf: 'center', // Center the button within its container
  },

  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  option: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#b5b5b5',
    marginVertical: 5,
    borderRadius: 5,
  },
  selectedOption: {
    backgroundColor: '#d67c7c',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedOptionText: {
    color: 'black',
    fontWeight: 'bold',
  },
  resultBox: {
    borderWidth: 1,
    borderColor: '#b5b5b5',
    padding: 20,
    borderRadius: 5,
    marginVertical: 10,
    alignItems: 'center',
  },
  bmiText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  legendContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  legendColorBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    marginRight: 10,
  },
  pickerContainer: {
    borderRadius: 5,
    width: 100,
    height: 40,
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#b5b5b5',
    borderRadius: 5,
    paddingHorizontal: 10,
    height: 40,
    width: 250,
    marginVertical: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 65,
  },
  infoText: {
    marginTop: 20,
    marginBottom: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#d67c7c',
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default Preferences;