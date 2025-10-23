require('dotenv').config();
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const Groq = require('groq-sdk');
const PastQuestion = require('../models/PastQuestion');
const axios = require('axios');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const client = new MongoClient(process.env.MONGO_URI);

//
// 🔹 Helper: Escape regex characters
//
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

//
// 🔹 UPDATED Helper: Find and format past questions with structured response
//
async function findPastQuestions(courseQuery) {
  const safeCourse = escapeRegex(courseQuery);
  const courseRegex = new RegExp(safeCourse, 'i');

  console.log('🔍 Searching for course:', courseQuery);

  // 🔸 Search by regex in DB
  const pastQuestions = await PastQuestion.find({
    course: { $regex: courseRegex },
  }).sort({ year: -1 });

  if (!pastQuestions || pastQuestions.length === 0) {
    console.log('❌ No match found for:', courseQuery);
    return {
      course: courseQuery.toUpperCase(),
      questions: [],
      message: `No past questions found for ${courseQuery}.`,
      yearsFound: 0,
      totalQuestions: 0
    };
  }

  // ✅ DEBUG: Log what we found in the database
  console.log('📊 Found documents:', pastQuestions.length);
  pastQuestions.forEach((pq, index) => {
    console.log(`📄 Document ${index + 1}:`, {
      course: pq.course,
      year: pq.year,
      questionsCount: pq.questions ? pq.questions.length : 0
    });
  });

  // ✅ Use the FIRST course name found in the database
  const courseTitle = pastQuestions[0].course ? 
    pastQuestions[0].course.toString().trim().toUpperCase() : 
    courseQuery.toUpperCase();

  console.log('🎯 Using course title:', courseTitle);

  // 🧩 Extract all questions into a single array
  const allQuestions = [];
  pastQuestions.forEach(pq => {
    if (pq.questions && Array.isArray(pq.questions)) {
      pq.questions.forEach(q => {
        if (q && q.number && q.text) {
          allQuestions.push({
            number: q.number.toString().trim(),
            text: q.text.toString().trim()
          });
        }
      });
    }
  });

  console.log(`✅ Found ${pastQuestions.length} record(s) for ${courseTitle} with ${allQuestions.length} questions`);

  return {
    course: courseTitle,
    questions: allQuestions,
    yearsFound: pastQuestions.length,
    totalQuestions: allQuestions.length,
    rawCourseData: pastQuestions.map(pq => pq.course) // For debugging
  };
}

//
// 🔹 UPDATED FLUTTER ENDPOINT
//
router.post('/', async (req, res) => {
  const { query, courseCode, year } = req.body;
  let responseData = {};

  try {
    await client.connect();
    const db = client.db('cs_chatbot');
    const analyticsCollection = db.collection('analytics');
    const feedbackCollection = db.collection('feedback');

    // Handle feedback
    if (query.toLowerCase().startsWith('feedback:')) {
      const feedbackText = query.substring(9).trim();
      await feedbackCollection.insertOne({
        user: 'flutter_user',
        feedback: feedbackText,
        timestamp: new Date(),
      });
      responseData = { response: 'Thank you for your feedback!' };
    } 
    // Handle past questions - with improved course detection
    else if (query.toLowerCase().includes('past questions') || courseCode) {
      let courseToSearch = courseCode;
      
      // If no courseCode provided in request body, extract from query
      if (!courseToSearch) {
        const courseMatch = query.match(/past questions for ([\w\s\d&]+)/i);
        courseToSearch = courseMatch ? courseMatch[1].trim() : null;
        
        // If still not found, try alternative patterns
        if (!courseToSearch) {
          const altMatch = query.match(/(CSC|MTH|PHY|CHM|BIO|STA|GES)\s*(\d{3})/i);
          if (altMatch) {
            courseToSearch = `${altMatch[1]} ${altMatch[2]}`;
          }
        }
      }

      console.log('🎯 Course to search:', courseToSearch);

      if (courseToSearch) {
        const pastQuestionsResult = await findPastQuestions(courseToSearch);
        responseData = { 
          response: pastQuestionsResult,
          isPastQuestions: true 
        };
      } else {
        responseData = { 
          response: 'Please specify a course (e.g., "past questions for Computer Networks" or "CSC 101").' 
        };
      }
    } 
    // General AI query
    else {
      try {
        const completion = await groq.chat.completions.create({
          model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant providing information about a Computer Science department. Answer concisely and accurately.',
            },
            { role: 'user', content: query },
          ],
          max_tokens: 4096,
          temperature: 0.7,
        });
        responseData = { 
          response: completion.choices[0].message.content.trim() 
        };
      } catch (error) {
        console.error('Groq error:', error);
        responseData = { 
          response: 'Sorry, an error occurred with the AI service. Please try again.' 
        };
      }
    }

    // Log analytics
    await analyticsCollection.insertOne({
      user: 'flutter_user',
      query,
      courseCode: courseCode || null,
      year: year || null,
      responseType: query.toLowerCase().includes('past questions') || courseCode ? 'past_questions' : 'general',
      response: responseData.response,
      timestamp: new Date(),
    });

    res.json(responseData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.close();
  }
});

// ... (WhatsApp webhook and other endpoints remain similar but updated)
router.post('/whatsapp-webhook', async (req, res) => {
  const { entry } = req.body;
  if (!entry || !entry.length) return res.status(400).send('Invalid payload');

  const message = entry[0].changes[0].value.messages[0];
  const from = message.from;
  const query = message.text.body.trim();
  let responseText = '';

  try {
    await client.connect();
    const db = client.db('cs_chatbot');
    const analyticsCollection = db.collection('analytics');
    const feedbackCollection = db.collection('feedback');

    // 💬 Handle Feedback
    if (query.toLowerCase().startsWith('feedback:')) {
      const feedbackText = query.substring(9).trim();
      await feedbackCollection.insertOne({
        user: from,
        feedback: feedbackText,
        timestamp: new Date(),
      });
      responseText = 'Thank you for your feedback!';
    }
    // 📚 Handle Past Questions
    else if (query.toLowerCase().includes('past questions')) {
      const courseMatch = query.match(/past questions for ([\w\s\d&]+)/i);
      const course = courseMatch ? courseMatch[1].trim() : null;

      if (course) {
        const pastQuestionsResult = await findPastQuestions(course);
        
        // Format for WhatsApp (string response)
        if (pastQuestionsResult.questions && pastQuestionsResult.questions.length > 0) {
          const questionsText = pastQuestionsResult.questions
            .map(q => `${q.number}. ${q.text}`)
            .join('\n');
          responseText = `📘 Past Questions for ${pastQuestionsResult.course}:\n\n${questionsText}\n\n✅ Total Questions: ${pastQuestionsResult.totalQuestions} from ${pastQuestionsResult.yearsFound} year(s)`;
        } else {
          responseText = pastQuestionsResult.message || `No past questions found for ${course}.`;
        }
      } else {
        responseText = 'Please specify a course (e.g., "past questions for Computer Networks").';
      }
    }
    // 🤖 AI General Query (Groq)
    else {
      try {
        const completion = await groq.chat.completions.create({
          model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant for a Computer Science department. Answer concisely and accurately.',
            },
            { role: 'user', content: query },
          ],
          max_tokens: 4096,
          temperature: 0.7,
        });
        responseText = completion.choices[0].message.content.trim();
      } catch (error) {
        if (error.status === 404 && error.error?.code === 'model_not_found') {
          responseText = 'Model temporarily unavailable. Try again later.';
        } else {
          console.error('Groq error:', error);
          responseText = 'Sorry, there was an issue with the AI service.';
        }
      }
    }

    // 🧾 Log analytics
    await analyticsCollection.insertOne({
      user: from,
      query,
      responseType: query.toLowerCase().includes('past questions')
        ? 'past_questions'
        : 'general',
      response: responseText,
      timestamp: new Date(),
    });

    // 📤 Send response to WhatsApp user via Brevo API
    await axios.post(
      'https://api.brevo.com/v3/transactionalWhatsApp/messages',
      {
        to: from,
        from: process.env.WABA_ID,
        type: 'text',
        text: { body: responseText },
      },
      {
        headers: {
          accept: 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json',
        },
      }
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error processing request');
  } finally {
    await client.close();
  }
});

//
// 🔹 VERIFY WEBHOOK (Brevo Setup Test)
//
router.get('/whatsapp-webhook', (req, res) => {
  res.status(200).send('Webhook ready');
});

module.exports = router;