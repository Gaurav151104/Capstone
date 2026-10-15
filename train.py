import os
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.metrics import recall_score, precision_score, f1_score, roc_auc_score

def train_and_evaluate():
    print("=" * 60)
    print("NeuroSense AI — Lifestyle Dementia Model Training")
    print("=" * 60)
    
    csv_path = "alzheimers_disease_data.csv"
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    df = pd.read_csv(csv_path)
    print(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")

    # Target variable
    target_col = "Diagnosis"
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in dataset.")

    # Leakage and identification columns to drop
    leakage_cols = [
        "PatientID",
        "DoctorInCharge",
        "MMSE",
        "FunctionalAssessment",
        "ADL",
        "BehavioralProblems",
        "MemoryComplaints"
    ]
    
    # Check which leakage columns are present
    dropped_cols = [c for c in leakage_cols if c in df.columns]
    print(f"\nDropping leakage and identifier columns ({len(dropped_cols)}):")
    for col in dropped_cols:
        print(f"  - {col}")

    # Feature columns
    feature_cols = [c for c in df.columns if c not in leakage_cols and c != target_col]
    print(f"\nRemaining clean feature columns ({len(feature_cols)}):")
    for i, col in enumerate(feature_cols, 1):
        print(f"  {i:2d}. {col}")

    X = df[feature_cols].copy()
    y = df[target_col].copy().values

    # Compute and store medians of clean features for robust imputation
    medians_dict = {col: float(X[col].median()) for col in feature_cols}

    # Class distribution
    num_neg = int(sum(y == 0))
    num_pos = int(sum(y == 1))
    pos_weight = num_neg / max(1, num_pos)
    print(f"\nClass balance: Negative (0) = {num_neg}, Positive (1) = {num_pos} (pos_weight={pos_weight:.2f})")

    # Define Candidate Models
    models = {
        "Logistic Regression": LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
            random_state=42
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=150,
            max_depth=6,
            class_weight="balanced",
            random_state=42
        ),
        "XGBoost": XGBClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.05,
            scale_pos_weight=pos_weight,
            eval_metric="logloss",
            random_state=42
        ),
        "LightGBM": LGBMClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.05,
            class_weight="balanced",
            random_state=42,
            verbose=-1
        )
    }

    # Stratified 5-Fold Cross Validation
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    results = {}

    print("\n" + "-" * 60)
    print("Running Stratified 5-Fold Cross Validation...")
    print("-" * 60)

    for name, model in models.items():
        fold_recalls, fold_precisions, fold_f1s, fold_aucs = [], [], [], []
        
        for train_idx, val_idx in skf.split(X.values, y):
            X_tr, X_val = X.values[train_idx], X.values[val_idx]
            y_tr, y_val = y[train_idx], y[val_idx]

            fold_scaler = StandardScaler()
            X_tr_scaled = fold_scaler.fit_transform(X_tr)
            X_val_scaled = fold_scaler.transform(X_val)

            model.fit(X_tr_scaled, y_tr)
            val_preds = model.predict(X_val_scaled)
            val_probs = model.predict_proba(X_val_scaled)[:, 1]

            fold_recalls.append(recall_score(y_val, val_preds, zero_division=0))
            fold_precisions.append(precision_score(y_val, val_preds, zero_division=0))
            fold_f1s.append(f1_score(y_val, val_preds, zero_division=0))
            fold_aucs.append(roc_auc_score(y_val, val_probs))

        mean_recall = float(np.mean(fold_recalls))
        mean_precision = float(np.mean(fold_precisions))
        mean_f1 = float(np.mean(fold_f1s))
        mean_auc = float(np.mean(fold_aucs))

        # Composite score prioritizing recall and ROC-AUC for clinical screening
        selection_score = (mean_recall * 0.5) + (mean_auc * 0.5)

        results[name] = {
            "recall": mean_recall,
            "precision": mean_precision,
            "f1": mean_f1,
            "roc_auc": mean_auc,
            "selection_score": selection_score,
            "model_template": model
        }

        print(f"[{name}]")
        print(f"  Recall   : {mean_recall:.4f}")
        print(f"  Precision: {mean_precision:.4f}")
        print(f"  F1-Score : {mean_f1:.4f}")
        print(f"  ROC-AUC  : {mean_auc:.4f}")
        print(f"  Selection Score (Recall+AUC): {selection_score:.4f}\n")

    # Select Best Model by Recall and ROC-AUC
    best_name = max(results, key=lambda k: results[k]["selection_score"])
    best_info = results[best_name]
    print("=" * 60)
    print(f"BEST MODEL SELECTED: {best_name}")
    print(f"  CV Recall : {best_info['recall']:.4f}")
    print(f"  CV ROC-AUC: {best_info['roc_auc']:.4f}")
    print(f"  CV F1     : {best_info['f1']:.4f}")
    print(f"  CV Prec   : {best_info['precision']:.4f}")
    print("=" * 60)

    # Fit final model and scaler on full clean dataset
    final_scaler = StandardScaler()
    X_scaled = final_scaler.fit_transform(X.values)
    
    final_model = best_info["model_template"]
    final_model.fit(X_scaled, y)

    # Save to models/dementia_bundle.pkl
    os.makedirs("models", exist_ok=True)
    bundle_path = os.path.join("models", "dementia_bundle.pkl")

    bundle = {
        "model": final_model,
        "model_name": best_name,
        "scaler": final_scaler,
        "features": feature_cols,
        "medians": medians_dict,
        "metrics": {
            "recall": best_info["recall"],
            "precision": best_info["precision"],
            "f1": best_info["f1"],
            "roc_auc": best_info["roc_auc"]
        }
    }

    joblib.dump(bundle, bundle_path)
    print(f"\nBundle successfully exported to: {bundle_path}")
    print("Export keys: ['model', 'scaler', 'features', 'medians', 'metrics', 'model_name']")
    print(f"Total features: {len(feature_cols)}")
    print("=" * 60)
    return bundle

if __name__ == "__main__":
    train_and_evaluate()
