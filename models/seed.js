require('dotenv').config(); // Load environment variables from .env file
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // Add UUID for unique IDs

// Load the existing PastQuestion model
const PastQuestion = require('./PastQuestion'); // Adjust path if necessary

// Sample data for CSC 451: Computer Networks and Communications (2024/2025 First Semester)
const computerNetworksCSC451Questions = [
  { id: uuidv4(), number: '1', text: 'What are the input strings for the following languages:\n(i) S → aASBb/€, A → a/€, B → bcd\n(ii) S → ASBBC, A → e/€, B → bbc/€, C → €\n(iii) S → aAb, aA → aaAb, A → €' },

  { id: uuidv4(), number: '2', text: '(i) What is a token?\n(ii) Give four types of token with their valid examples.\n(iii) Discuss the analysis and synthesis phases of a typical compiler.' },

  { id: uuidv4(), number: '3', text: '(i) Why is symbol table called a book keeper?\n(ii) In symbol table entries, appropriately classify the following expressions:\n(a) int x = 10;\n(b) System.out.println("ABSU Students are wonderful");\n(c) Float pie = 3.142;' },

  { id: uuidv4(), number: '4', text: 'T is the set of terminals, V is the set of non-terminals, P is the productions and S is the starting symbol. In a tabular form, determine the T, V, P and S of the following grammars:\n(a) S → ABSe/€\n(b) aA → E + e/E + E\n(c) AB → E/€' },

  { id: uuidv4(), number: '5', text: 'Construct a top-down parser for the following:\n(a) S → cAd, A → ab/a, w(input string = cad)\n(b) S → aBC, B → cd, C → ad/e/. Input string = acde' },

  { id: uuidv4(), number: '6', text: 'Construct a bottom-up parser using the input string abcde for the following grammar:\n(a) A → ab, B → de, C → bc, S → ACB\n(b) S → bb, C → a, E → cd, D → e, S → CED' },
];

// Seeding function
async function seedPastQuestions() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB at', new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));

    // Define the course details
    const courseFilter = {
      course: 'CSC 451: Computer Networks and Communications',
      year: 2024,
      examSession: '2024/2025',
    };

    // Data to insert or update
    const updateData = {
      course: 'CSC 451: Computer Networks and Communications',
      courseTitle: 'Computer Networks and Communications',
      courseCode: 'CSC 451',
      department: 'Computer Science Department',
      university: 'Abia State University, Uturu',
      semester: 'First',
      year: 2024,
      examSession: '2024/2025',
      instructions: 'ANSWER QUESTION 1 AND ANY OTHER 3 QUESTIONS.\nTIME ALLOWED: 2HRS.',
      questions: computerNetworksCSC451Questions,
    };

    // Upsert (update if exists, insert if not)
    const result = await PastQuestion.findOneAndUpdate(courseFilter, updateData, {
      new: true,      // Return the updated document
      upsert: true,   // Insert if not found
      setDefaultsOnInsert: true,
    });

    if (result) {
      console.log(`✅ Course "${updateData.course}" (2024/2025) has been added or updated successfully.`);
      console.log(`Contains ${computerNetworksCSC451Questions.length} questions.`);
    }

    console.log('Seeding complete for CSC 451: Computer Networks and Communications (2024/2025)');
  } catch (error) {
    console.error('❌ Error seeding data:', error.message || error);
    if (error.name === 'MongoNetworkError') {
      console.error('Check your MONGO_URI in .env file or network connection.');
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB at', new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
  }
}

// Run the seeding script
seedPastQuestions().then(() => process.exit(0)).catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
