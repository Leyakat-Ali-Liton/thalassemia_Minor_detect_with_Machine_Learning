import sys
import os
import json
import base64
import io
import pandas as pd
import numpy as np
import pickle
import matplotlib.pyplot as plt
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# Add path handling to find the model and data
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'thalassemia_model.pkl')
TEST_DATA_PATH = os.path.join(BASE_DIR, 'data', 'thalassemia_test.csv')

def get_metrics_as_json():
    try:
        # 1. Load Model and Data
        if not os.path.exists(MODEL_PATH) or not os.path.exists(TEST_DATA_PATH):
            return {"error": "Model or Test data file not found."}

        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)

        test_df = pd.read_csv(TEST_DATA_PATH)
        X_test = test_df.drop(['Prediction'], axis=1, errors='ignore')
        y_test = test_df['Prediction']

        # 2. Generate Predictions
        y_pred = model.predict(X_test)

        # 3. Calculate Text Metrics
        metrics = {
            "accuracy": round(accuracy_score(y_test, y_pred), 2),
            "precision": round(precision_score(y_test, y_pred, zero_division=0), 2),
            "recall": round(recall_score(y_test, y_pred, zero_division=0), 2),
            "f1": round(f1_score(y_test, y_pred, zero_division=0), 2)
        }

        # 4. Generate Confusion Matrix Plot
        cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
        fig_cm, ax = plt.subplots(figsize=(5, 4))
        cax = ax.matshow(cm, cmap='Blues')
        fig_cm.colorbar(cax)
        
        for i in range(2):
            for j in range(2):
                ax.text(j, i, str(cm[i, j]), va='center', ha='center', 
                        fontsize=12, color="white" if cm[i,j] > cm.max()/2 else "black")
        
        ax.set_xticklabels(['', 'Normal', 'Thalassemia'])
        ax.set_yticklabels(['', 'Normal', 'Thalassemia'])
        ax.set_title('Confusion Matrix')
        
        # Convert CM plot to Base64 string for Web
        buf_cm = io.BytesIO()
        plt.savefig(buf_cm, format='png', bbox_inches='tight')
        buf_cm.seek(0)
        metrics['cm_image'] = base64.b64encode(buf_cm.read()).decode('utf-8')
        plt.close(fig_cm)

        # 5. Generate Feature Importance Plot
        importances = model.feature_importances_
        sorted_idx = np.argsort(importances)
        fig_fi, ax_fi = plt.subplots(figsize=(6, 4))
        ax_fi.barh(range(len(importances)), importances[sorted_idx], align='center', color='skyblue')
        ax_fi.set_yticks(range(len(importances)))
        ax_fi.set_yticklabels(X_test.columns[sorted_idx])
        ax_fi.set_title("Feature Importance")

        # Convert FI plot to Base64 string for Web
        buf_fi = io.BytesIO()
        plt.savefig(buf_fi, format='png', bbox_inches='tight')
        buf_fi.seek(0)
        metrics['fi_image'] = base64.b64encode(buf_fi.read()).decode('utf-8')
        plt.close(fig_fi)

        return metrics

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # Print the JSON result so Node.js can capture it
    result = get_metrics_as_json()
    print(json.dumps(result))