import os
import joblib
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import warnings

from sklearn.model_selection import train_test_split, RandomizedSearchCV, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, roc_auc_score

from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from xgboost import XGBClassifier

warnings.filterwarnings('ignore')

def main():
    print("\n==================================================")
    print("   TRAINING & EXPORTING DEMENTIA DETECTION MODEL  ")
    print("==================================================\n")
    
    # Configuration
    file_path = "pitt_features.csv" 
    target_column = "label"  # The target column in pitt_features.csv is 'label'
    random_seed = 42

    print("-> [1] Loading Pitt Audio Dataset...")
    df = pd.read_csv(file_path)
    print(f"   Success! Dataset loaded with shape: {df.shape}")

    print("\n-> [2] Separating Features (X) and Target (y)...")
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found.")
        
    X = df.drop(columns=[target_column])
    y = df[target_column]

    target_classes = len(np.unique(y))
    is_binary = target_classes == 2

    print("-> [3] Splitting Data into 80% Training and 20% Testing (Stratified)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=random_seed
    )
    feature_names = X.columns.tolist()

    print("\n-> [4] Constructing Leakage-Proof Imblearn Pipeline...")
    pipeline = ImbPipeline(steps=[
        ('scaler', StandardScaler()),
        ('smote', SMOTE(random_state=random_seed)),
        ('xgb', XGBClassifier(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=random_seed,
            eval_metric="logloss",
            use_label_encoder=False
        ))
    ])

    print("-> [5] Tuning Hyperparameters via RandomizedSearchCV (5-Fold CV)...")
    param_grid = {
        'xgb__n_estimators': [100, 300, 500],
        'xgb__learning_rate': [0.01, 0.05, 0.1],
        'xgb__max_depth': [3, 6, 9]
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=random_seed)
    
    search = RandomizedSearchCV(
        estimator=pipeline,
        param_distributions=param_grid,
        n_iter=5, # Reduced for faster training
        scoring='accuracy',
        cv=cv,
        verbose=1,
        n_jobs=-1,
        random_state=random_seed
    )

    print("   Starting convergence... (this may take a moment)")
    search.fit(X_train, y_train)
    
    best_pipeline = search.best_estimator_
    best_params = search.best_params_
    
    print(f"\n   Mean CV Accuracy: {search.best_score_:.4f}")

    print("-> [6] Evaluating Best Model on Test Dataset...")
    y_pred = best_pipeline.predict(X_test)
    
    if is_binary:
        y_pred_proba = best_pipeline.predict_proba(X_test)[:, 1]
    
    final_accuracy = accuracy_score(y_test, y_pred)
    
    print("\n--- Testing Performance ---")
    print(f"Accuracy : {final_accuracy:.4f}")
    if is_binary:
        roc_score = roc_auc_score(y_test, y_pred_proba)
        print(f"ROC-AUC  : {roc_score:.4f}")
        
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    print("\n-> [7] Exporting Models for Backend (`app.py`)...")
    # app.py expects scalar and model separately inside the backend directory!
    os.makedirs('backend', exist_ok=True)
    
    # Extract the fitted scaler and xgboost model from the best pipeline
    fitted_scaler = best_pipeline.named_steps['scaler']
    fitted_xgb = best_pipeline.named_steps['xgb']
    
    scaler_path = os.path.join('backend', 'scaler.pkl')
    model_path = os.path.join('backend', 'dementia_model.pkl')
    
    joblib.dump(fitted_scaler, scaler_path)
    joblib.dump(fitted_xgb, model_path)
    
    print(f"   SUCCESS! Saved scaler to: {scaler_path}")
    print(f"   SUCCESS! Saved model to: {model_path}")
    print("\n-> The backend is now fully unlocked and ready to process audio!\n")

if __name__ == "__main__":
    main()
