import sys
import os
import json
import pickle
import pandas as pd
import warnings

warnings.filterwarnings("ignore")

# -------------------- Setup Paths --------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'thalassemia_model.pkl')

def predict():
    try:
       
        args = sys.argv[1:]
        if len(args) < 11:
            return {"error": "Missing input arguments"}

        age = int(args[0])
        gender = args[1]
        hb = float(args[2])
        mcv = float(args[3])
        mch = float(args[4])
        rdw = float(args[5])
        rbc = float(args[6])
        
        
        fatigue_freq = int(args[7])
        family_relation = int(args[8])
        jaundice = int(args[9])
        spleen_chole = int(args[10])

        
        mentzer_index = round(mcv / rbc, 2) if rbc > 0 else 0
        green_king_index = round(((mcv ** 2) * rdw) / (hb * 100), 2) if hb > 0 else 0

        if not os.path.exists(MODEL_PATH):
            return {"error": "Model file not found!"}

        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)

        feature_names = ["Hb", "MCV", "MCH", "RDW", "RBC", "Fatigue Frequency", 
                         "Family Relation", "Jaundice", "Splenomegaly or Cholelithiasis", 
                         "Mentzer Index", "Green King Index"]

        input_df = pd.DataFrame([[hb, mcv, mch, rdw, rbc, fatigue_freq, family_relation, 
                                  jaundice, spleen_chole, mentzer_index, green_king_index]], 
                                columns=feature_names)

        prob = model.predict_proba(input_df)[0][1]

        if prob >= 0.80:
            thal_res, thal_col = "Thalassemia Minor", "red"
        elif prob >= 0.55:
            thal_res, thal_col = "Likely Thalassemia Minor", "orange"
        else:
            thal_res, thal_col = "Normal Healthy", "green"

        
        if age >= 15:
            hb_threshold = 13.0 if gender.lower() == "male" else 12.0
        else:
            hb_threshold = 11.5  # শিশুদের জন্য গড় মান

        iron_result = "No Iron Deficiency"
        iron_color = "green"

       
        if mentzer_index > 13:
            
            if rdw > 14.5:
                
                if hb < hb_threshold or mch < 26:
                    iron_result = "Iron Deficiency Positive"
                    iron_color = "red"
            
            elif hb >= hb_threshold and (mch < 24 or mcv < 78):
                iron_result = "Iron Deficiency Positive"
                iron_color = "red"

        
        return {
            "thalassemia": thal_res,
            "thalColor": thal_col,
            "iron": iron_result,
            "ironColor": iron_color,
            "probability": round(float(prob), 4),
            "mentzer": mentzer_index,
            "greenKing": green_king_index
        }

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    result = predict()
    print(json.dumps(result))