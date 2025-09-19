from flask import Flask, render_template, request, jsonify
import json
import numpy as np
import pickle
import os
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import LabelEncoder

app = Flask(__name__)

# Load JSON data with error handling
def load_json(filename):
    try:
        with open(f'data/{filename}', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Error: {filename} not found in data/ directory")
    except json.JSONDecodeError:
        raise ValueError(f"Error: Invalid JSON format in {filename}")

# Load quiz and college data
try:
    QUIZ_DATA = load_json('quiz_data.json')
    COLLEGES_DATA = load_json('colleges_data.json')
except Exception as e:
    print(f"Failed to load JSON data: {e}")
    raise

# AI Model for Career Guidance
training_profiles = np.array([
    [4, 1, 0],  # High science -> Engineer
    [3, 2, 0],  # Science lean -> Doctor
    [5, 0, 0],  # Pure science -> Scientist
    [2, 4, 0],  # High arts -> Journalist
    [1, 4, 1],  # Arts lean -> Lawyer
    [0, 5, 0],  # Pure arts -> Teacher
    [0, 1, 4],  # High commerce -> Accountant
    [1, 0, 4],  # Commerce lean -> Banker
    [0, 0, 5],  # Pure commerce -> Entrepreneur
    [2, 2, 2],  # Balanced -> Marketer
    [3, 1, 1],  # Science with some commerce -> Data Analyst
    [1, 3, 1],  # Arts with some commerce -> Designer
])

# Corresponding career labels
career_labels = ['Engineer', 'Doctor', 'Scientist', 'Journalist', 'Lawyer', 'Teacher',
                 'Accountant', 'Banker', 'Entrepreneur', 'Marketer', 'Data Analyst', 'Designer']

# Encode labels for model
le = LabelEncoder()
career_encoded = le.fit_transform(career_labels)

# Train or load KNN model (k=3 for top 3 recommendations)
model_path = 'career_model.pkl'
try:
    if os.path.exists(model_path):
        with open(model_path, 'rb') as f:
            knn_model = pickle.load(f)
    else:
        knn_model = NearestNeighbors(n_neighbors=3, metric='euclidean')
        knn_model.fit(training_profiles)
        with open(model_path, 'wb') as f:
            pickle.dump(knn_model, f)
except Exception as e:
    print(f"Failed to load or train KNN model: {e}")
    raise

def get_ai_career_recommendations(scores):
    try:
        score_vector = np.array([[scores['science'], scores['arts'], scores['commerce']]])
        distances, indices = knn_model.kneighbors(score_vector)
        top_careers = [career_labels[idx] for idx in indices[0]]
        return top_careers
    except KeyError as e:
        raise KeyError(f"Missing score key: {e}")
    except Exception as e:
        raise ValueError(f"Error in AI recommendation: {e}")

# Routes
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/quiz')
def quiz():
    try:
        return render_template('quiz.html', questions=QUIZ_DATA['questions'])
    except KeyError:
        return jsonify({"error": "Quiz data malformed: missing 'questions' key"}), 500

@app.route('/submit_quiz', methods=['POST'])
def submit_quiz():
    try:
        data = request.get_json()
        if not data or 'answers' not in data:
            return jsonify({"error": "Invalid or missing 'answers' in request"}), 400
        
        answers = data['answers']
        if len(answers) != 5:
            return jsonify({"error": "Please answer all 5 questions"}), 400
        
        # Initialize scores
        scores = {"science": 0, "arts": 0, "commerce": 0}
        valid_streams = set(scores.keys())
        
        # Count occurrences of each stream
        for ans in answers:
            if ans in valid_streams:
                scores[ans] += 1
            else:
                return jsonify({"error": f"Invalid answer value: {ans}"}), 400
        
        # Determine top stream
        top_stream = max(scores, key=scores.get)
        
        # Verify stream exists in QUIZ_DATA
        if top_stream not in QUIZ_DATA['stream_suggestions']:
            return jsonify({"error": f"Stream '{top_stream}' not found in suggestions"}), 500
        
        suggestion = QUIZ_DATA['stream_suggestions'][top_stream]
        
        # Get AI career recommendations
        ai_careers = get_ai_career_recommendations(scores)
        
        return jsonify({
            "suggestion": suggestion,
            "scores": scores,
            "ai_careers": ai_careers
        })
    except KeyError as e:
        return jsonify({"error": f"Key error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/colleges')
def colleges():
    try:
        return render_template('colleges.html', colleges=COLLEGES_DATA)
    except Exception as e:
        return jsonify({"error": f"Error loading colleges: {str(e)}"}), 500

@app.route('/career/<stream>')
def career_path(stream):
    try:
        # Map URL-friendly stream names to QUIZ_DATA keys
        stream_map = {
            'science-stream': 'science',
            'arts-stream': 'arts',
            'commerce-stream': 'commerce'
        }
        stream_key = stream_map.get(stream, stream)
        if stream_key in QUIZ_DATA['stream_suggestions']:
            return render_template('career.html', stream_data=QUIZ_DATA['stream_suggestions'][stream_key])
        return jsonify({"error": f"Stream '{stream}' not found"}), 404
    except Exception as e:
        return jsonify({"error": f"Error loading career path: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)