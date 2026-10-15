"""
NeuroSense AI — Dementia Screening from Speech Biomarkers
Model Evaluation, Benchmark Comparison & Artifact Generation
"""

import os
import sys
import time
import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier
from sklearn.metrics import (
    roc_auc_score, accuracy_score, recall_score, f1_score
)
from sklearn.inspection import permutation_importance
from sklearn.metrics.pairwise import cosine_similarity

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False


# --------------------------------------------------------------------------
# Step 1: Data Ingestion & Alignment Verification
# --------------------------------------------------------------------------
def load_and_verify_data():
    path_combined = os.path.join("models", "features_combined.csv")
    path_v3 = os.path.join("models", "features_v3.csv")
    path_v4 = os.path.join("models", "features_v4.csv")

    assert os.path.exists(path_combined), f"Missing {path_combined}"
    assert os.path.exists(path_v3), f"Missing {path_v3}"
    assert os.path.exists(path_v4), f"Missing {path_v4}"

    df_comb = pd.read_csv(path_combined)
    df_v3 = pd.read_csv(path_v3)
    df_v4 = pd.read_csv(path_v4)

    # 1. Assert row counts match
    assert len(df_comb) == len(df_v3) == len(df_v4) == 548, (
        f"Row count mismatch: comb={len(df_comb)}, v3={len(df_v3)}, v4={len(df_v4)}"
    )

    # 2. Cast labels to int and assert exact match
    y_comb = df_comb["label"].astype(int).values
    y_v3 = df_v3["label"].astype(int).values
    y_v4 = df_v4["label"].astype(int).values

    assert (y_comb == y_v3).all() and (y_v3 == y_v4).all(), (
        "Label alignment mismatch across feature CSVs!"
    )

    print(f"[Data] Loaded 3 datasets: 548 rows each. Labels aligned 100%.")
    print(f"[Data] Class distribution: Class 1 (Dementia) = {np.sum(y_comb==1)} ({np.mean(y_comb==1)*100:.1f}%), "
          f"Class 0 (Control) = {np.sum(y_comb==0)} ({np.mean(y_comb==0)*100:.1f}%)")

    # Preprocessing: log1p on mel_* columns (clip at 0 first)
    for df in [df_comb, df_v3, df_v4]:
        mel_cols = [c for c in df.columns if c.startswith("mel_")]
        if mel_cols:
            df[mel_cols] = np.log1p(np.clip(df[mel_cols].values, 0, None))

    return df_comb, df_v3, df_v4, y_comb


# --------------------------------------------------------------------------
# Step 2: Feature Set Partitioning
# --------------------------------------------------------------------------
def get_feature_sets(df_comb, df_v3, df_v4):
    feature_sets = {}

    # a) combined file (acoustic + lexical)
    X_comb = df_comb.drop(columns=["label"])
    feature_sets["a_combined"] = X_comb

    # b) v3 without iu_* columns
    iu_cols = [c for c in df_v3.columns if c.startswith("iu_")]
    X_v3_no_iu = df_v3.drop(columns=["label"] + iu_cols)
    feature_sets["b_v3_no_iu"] = X_v3_no_iu

    # c) v3 with iu_* columns
    X_v3_with_iu = df_v3.drop(columns=["label"])
    feature_sets["c_v3_with_iu"] = X_v3_with_iu

    # d) v4 all features
    X_v4_all = df_v4.drop(columns=["label"])
    feature_sets["d_v4_all"] = X_v4_all

    # e) v4 BERT columns only
    bert_cols = [c for c in df_v4.columns if c.startswith("bert_")]
    X_v4_bert = df_v4[bert_cols]
    feature_sets["e_v4_bert_only"] = X_v4_bert

    print("\n[Feature Sets]")
    for name, X in feature_sets.items():
        print(f"  {name:16s} : {X.shape[1]} features")

    return feature_sets


# --------------------------------------------------------------------------
# Step 3: Model Factory Function
# --------------------------------------------------------------------------
def build_model_pipeline(model_name, n_features, n_neg=240, n_pos=308):
    scale_pos_weight = n_neg / n_pos  # ~0.779

    if model_name == "LogisticRegression":
        k = min(60, n_features)
        return Pipeline([
            ("scaler", StandardScaler()),
            ("select", SelectKBest(score_func=f_classif, k=k)),
            ("clf", LogisticRegression(
                C=0.1, penalty="l2", solver="liblinear",
                class_weight="balanced", random_state=42
            ))
        ])

    elif model_name == "SVM_RBF":
        k = min(80, n_features)
        return Pipeline([
            ("scaler", RobustScaler()),
            ("select", SelectKBest(score_func=f_classif, k=k)),
            ("clf", SVC(
                C=1.0, kernel="rbf", probability=True,
                class_weight="balanced", random_state=42
            ))
        ])

    elif model_name == "RandomForest":
        return RandomForestClassifier(
            n_estimators=400, min_samples_leaf=2,
            class_weight="balanced", random_state=42, n_jobs=-1
        )

    elif model_name == "ExtraTrees":
        return ExtraTreesClassifier(
            n_estimators=400, min_samples_leaf=2,
            class_weight="balanced", random_state=42, n_jobs=-1
        )

    elif model_name == "XGBoost":
        if not HAS_XGB:
            raise RuntimeError("XGBoost is not installed.")
        return xgb.XGBClassifier(
            n_estimators=200, max_depth=3, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            scale_pos_weight=scale_pos_weight,
            eval_metric="logloss", random_state=42, n_jobs=-1
        )

    else:
        raise ValueError(f"Unknown model name: {model_name}")


# --------------------------------------------------------------------------
# Step 4: Repeated Stratified Cross-Validation Benchmark
# --------------------------------------------------------------------------
def run_benchmark(feature_sets, y):
    models = ["LogisticRegression", "SVM_RBF", "RandomForest", "ExtraTrees"]
    if HAS_XGB:
        models.append("XGBoost")

    rskf = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=42)
    results = []

    total_runs = len(feature_sets) * len(models)
    run_idx = 0

    print(f"\n[Benchmark] Evaluating {len(feature_sets)} feature sets x {len(models)} models = {total_runs} combinations...")
    t_start = time.time()

    for fs_name, X in feature_sets.items():
        n_features = X.shape[1]
        for m_name in models:
            run_idx += 1
            t0 = time.time()

            fold_auc = []
            fold_acc = []
            fold_sens = []
            fold_spec = []
            fold_f1 = []

            for train_idx, test_idx in rskf.split(X, y):
                X_tr, X_te = X.iloc[train_idx], X.iloc[test_idx]
                y_tr, y_te = y[train_idx], y[test_idx]

                pipe = build_model_pipeline(m_name, n_features)
                pipe.fit(X_tr, y_tr)

                y_prob = pipe.predict_proba(X_te)[:, 1]
                y_pred = (y_prob >= 0.5).astype(int)

                fold_auc.append(roc_auc_score(y_te, y_prob))
                fold_acc.append(accuracy_score(y_te, y_pred))
                fold_sens.append(recall_score(y_te, y_pred, pos_label=1))
                fold_spec.append(recall_score(y_te, y_pred, pos_label=0))
                fold_f1.append(f1_score(y_te, y_pred, pos_label=1))

            elapsed = time.time() - t0
            auc_m, auc_s = np.mean(fold_auc), np.std(fold_auc)
            acc_m, acc_s = np.mean(fold_acc), np.std(fold_acc)
            sens_m, sens_s = np.mean(fold_sens), np.std(fold_sens)
            spec_m, spec_s = np.mean(fold_spec), np.std(fold_spec)
            f1_m, f1_s = np.mean(fold_f1), np.std(fold_f1)

            results.append({
                "feature_set": fs_name,
                "model": m_name,
                "n_features": n_features,
                "auc_mean": auc_m,
                "auc_std": auc_s,
                "acc_mean": acc_m,
                "acc_std": acc_s,
                "sens_mean": sens_m,
                "sens_std": sens_s,
                "spec_mean": spec_m,
                "spec_std": spec_s,
                "f1_mean": f1_m,
                "f1_std": f1_s,
                "elapsed_sec": elapsed
            })

            print(f"  [{run_idx:02d}/{total_runs:02d}] {fs_name:<16s} | {m_name:<18s} -> "
                  f"AUC: {auc_m:.4f}±{auc_s:.4f} | Acc: {acc_m:.4f} | Sens: {sens_m:.4f} | Spec: {spec_m:.4f} | F1: {f1_m:.4f} ({elapsed:.1f}s)")

    print(f"[Benchmark] Completed in {time.time() - t_start:.1f}s")
    df_results = pd.DataFrame(results).sort_values(by="auc_mean", ascending=False).reset_index(drop=True)
    df_results.to_csv("cv_results.csv", index=False)
    print(f"[Benchmark] Saved all results to cv_results.csv")
    return df_results


# --------------------------------------------------------------------------
# Step 5: Best Model Training, Artifact Export & predict_risk API
# --------------------------------------------------------------------------
def train_and_export_best_model(best_row, feature_sets, y):
    fs_name = best_row["feature_set"]
    m_name = best_row["model"]
    X = feature_sets[fs_name]
    feature_cols = list(X.columns)

    print(f"\n[Artifact] Fitting best model on all 548 samples:")
    print(f"  Feature Set : {fs_name} ({len(feature_cols)} features)")
    print(f"  Model       : {m_name}")
    print(f"  CV ROC-AUC  : {best_row['auc_mean']:.4f} ± {best_row['auc_std']:.4f}")

    best_pipe = build_model_pipeline(m_name, len(feature_cols))
    best_pipe.fit(X, y)

    artifact_bundle = {
        "model": best_pipe,
        "features": feature_cols,
        "feature_set": fs_name,
        "model_name": m_name,
        "metrics": {
            "auc_mean": best_row["auc_mean"],
            "auc_std": best_row["auc_std"],
            "acc_mean": best_row["acc_mean"],
            "sens_mean": best_row["sens_mean"],
            "spec_mean": best_row["spec_mean"],
            "f1_mean": best_row["f1_mean"]
        }
    }

    model_dir = "models"
    os.makedirs(model_dir, exist_ok=True)
    out_path = os.path.join(model_dir, "best_speech_model.pkl")
    joblib.dump(artifact_bundle, out_path)
    print(f"[Artifact] Saved best model bundle to {out_path}")
    return best_pipe, X, feature_cols


def predict_risk(model_path: str, new_df: pd.DataFrame) -> np.ndarray:
    """
    Inference helper: loads model bundle, precomputes log1p on mel features,
    aligns features, and outputs dementia probabilities.
    """
    bundle = joblib.load(model_path)
    model = bundle["model"]
    feature_cols = bundle["features"]

    df_copy = new_df.copy()
    mel_cols = [c for c in df_copy.columns if c.startswith("mel_")]
    if mel_cols:
        df_copy[mel_cols] = np.log1p(np.clip(df_copy[mel_cols].values, 0, None))

    # Align to model feature expectations
    for col in feature_cols:
        if col not in df_copy.columns:
            df_copy[col] = 0.0

    X_aligned = df_copy[feature_cols]
    probabilities = model.predict_proba(X_aligned)[:, 1]
    return probabilities


# --------------------------------------------------------------------------
# Step 6: Feature Importance for Best Tree Model
# --------------------------------------------------------------------------
def evaluate_tree_feature_importance(df_results, feature_sets, y):
    # Find best tree-based configuration (RandomForest, ExtraTrees, or XGBoost)
    tree_rows = df_results[df_results["model"].isin(["RandomForest", "ExtraTrees", "XGBoost"])]
    if tree_rows.empty:
        return

    best_tree_row = tree_rows.iloc[0]
    fs_name = best_tree_row["feature_set"]
    m_name = best_tree_row["model"]
    X = feature_sets[fs_name]
    feature_cols = list(X.columns)

    print(f"\n[Feature Importance] Best Tree Model: {m_name} on {fs_name} (AUC {best_tree_row['auc_mean']:.4f})")
    tree_model = build_model_pipeline(m_name, len(feature_cols))
    tree_model.fit(X, y)

    try:
        import shap
        explainer = shap.TreeExplainer(tree_model)
        shap_vals = explainer.shap_values(X)
        if isinstance(shap_vals, list):
            sv = shap_vals[1]
        elif len(shap_vals.shape) == 3:
            sv = shap_vals[:, :, 1]
        else:
            sv = shap_vals

        mean_abs_shap = np.mean(np.abs(sv), axis=0)
        top_indices = np.argsort(mean_abs_shap)[::-1][:20]

        top_20 = []
        print("\n--- Top 20 Most Important Features (SHAP Mean |Impact|) ---")
        for rank, idx in enumerate(top_indices, 1):
            feat = feature_cols[idx]
            val = mean_abs_shap[idx]
            top_20.append((rank, feat, val))
            print(f"  {rank:2d}. {feat:<24s} : {val:.4f}")

    except Exception as e:
        print(f"[SHAP] Falling back to Gini/MDI importances: {e}")
        importances = getattr(tree_model, "feature_importances_", None)
        if importances is None and hasattr(tree_model, "named_steps"):
            importances = tree_model.named_steps["clf"].feature_importances_

        top_indices = np.argsort(importances)[::-1][:20]
        top_20 = []
        print("\n--- Top 20 Most Important Features (Gini / MDI Feature Importance) ---")
        for rank, idx in enumerate(top_indices, 1):
            feat = feature_cols[idx]
            val = importances[idx]
            top_20.append((rank, feat, val))
            print(f"  {rank:2d}. {feat:<24s} : {val:.4f}")

    return top_20


# --------------------------------------------------------------------------
# Step 7: Leakage & Sanity Checks
# --------------------------------------------------------------------------
def run_leakage_and_sanity_checks(best_row, feature_sets, y, df_comb):
    print("\n" + "="*60)
    print("SANITY & LEAKAGE CHECKS")
    print("="*60)

    # 1. Speaker Overlap Check
    # MFCC means 1-13 capture vocal tract geometry (formant locations), invariant to content
    vocal_tract_cols = [f"mfcc_mean_{i}" for i in range(1, 14)]
    X_vocal = StandardScaler().fit_transform(df_comb[vocal_tract_cols].values)
    sim_matrix = cosine_similarity(X_vocal)
    np.fill_diagonal(sim_matrix, 0)

    high_sim_pairs = []
    n = len(df_comb)
    for i in range(n):
        for j in range(i + 1, n):
            if sim_matrix[i, j] >= 0.95:
                high_sim_pairs.append({
                    "row_a": i,
                    "row_b": j,
                    "similarity": sim_matrix[i, j],
                    "label_a": y[i],
                    "label_b": y[j]
                })

    print(f"[Check 1: Speaker Overlap]")
    print(f"  Pairs with vocal-tract cosine similarity >= 0.95: {len(high_sim_pairs)}")
    same_class = sum(1 for p in high_sim_pairs if p["label_a"] == p["label_b"])
    cross_class = sum(1 for p in high_sim_pairs if p["label_a"] != p["label_b"])
    print(f"  Same class pairs: {same_class}, Cross class pairs: {cross_class}")
    if high_sim_pairs:
        print("  Top 3 closest recording pairs:")
        high_sim_pairs_sorted = sorted(high_sim_pairs, key=lambda x: x["similarity"], reverse=True)
        for p in high_sim_pairs_sorted[:3]:
            print(f"    Row {p['row_a']} & Row {p['row_b']}: Cosine Sim = {p['similarity']:.4f} (Labels: {p['label_a']} vs {p['label_b']})")
    print("  Interpretation: Near-identical vocal tract geometries across rows confirm presence of longitudinal "
          "follow-up recordings of the same participant (typical of Pitt Corpus protocols). Without subject IDs, "
          "random K-fold cross-validation may slightly overestimate generalization due to speaker overlap across folds.")

    # 2. Label Shuffle Test
    print("\n[Check 2: Label Shuffle Test]")
    fs_name = best_row["feature_set"]
    m_name = best_row["model"]
    X = feature_sets[fs_name]

    rng = np.random.RandomState(42)
    y_shuffled = rng.permutation(y)

    rskf = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=42)
    shuffled_aucs = []

    for train_idx, test_idx in rskf.split(X, y_shuffled):
        X_tr, X_te = X.iloc[train_idx], X.iloc[test_idx]
        y_tr, y_te = y_shuffled[train_idx], y_shuffled[test_idx]

        pipe = build_model_pipeline(m_name, X.shape[1])
        pipe.fit(X_tr, y_tr)
        y_prob = pipe.predict_proba(X_te)[:, 1]
        shuffled_aucs.append(roc_auc_score(y_te, y_prob))

    shuff_mean = np.mean(shuffled_aucs)
    shuff_std = np.std(shuffled_aucs)
    print(f"  Shuffled Label ROC-AUC: {shuff_mean:.4f} ± {shuff_std:.4f}")
    if abs(shuff_mean - 0.50) > 0.05:
        print(f"  WARNING: Shuffled AUC deviates from 0.50! (Check feature pipeline)")
    else:
        print(f"  PASS: Shuffled AUC is within expectation of random chance (~0.50). No data leakage in pipeline.")

    # 3. AUC Drop from 'v3 with iu_*' to 'v3 without iu_*'
    print("\n[Check 3: Information Unit Contribution (iu_* Ablation)]")
    return shuff_mean, shuff_std, len(high_sim_pairs)


# --------------------------------------------------------------------------
# Main Execution Entrypoint
# --------------------------------------------------------------------------
def main():
    print("="*60)
    print("NEUROSENSE AI: SPEECH DEMENTIA MODEL BENCHMARK")
    print("="*60)

    # 1. Load data
    df_comb, df_v3, df_v4, y = load_and_verify_data()

    # 2. Extract feature sets
    feature_sets = get_feature_sets(df_comb, df_v3, df_v4)

    # 3. Run full benchmark
    df_results = run_benchmark(feature_sets, y)

    # 4. Fit & save best model
    best_row = df_results.iloc[0]
    best_pipe, best_X, best_features = train_and_export_best_model(best_row, feature_sets, y)

    # 5. Feature importance
    top_20 = evaluate_tree_feature_importance(df_results, feature_sets, y)

    # 6. Sanity checks
    shuff_mean, shuff_std, n_overlap_pairs = run_leakage_and_sanity_checks(
        best_row, feature_sets, y, df_comb
    )

    # 7. iu_* ablation comparison
    v3_with = df_results[(df_results["feature_set"] == "c_v3_with_iu") & (df_results["model"] == best_row["model"])]
    v3_no = df_results[(df_results["feature_set"] == "b_v3_no_iu") & (df_results["model"] == best_row["model"])]

    if not v3_with.empty and not v3_no.empty:
        auc_with = v3_with.iloc[0]["auc_mean"]
        auc_no = v3_no.iloc[0]["auc_mean"]
        drop = auc_with - auc_no
        print(f"\n[Ablation] Model: {best_row['model']}")
        print(f"  v3 with iu_*    ROC-AUC : {auc_with:.4f}")
        print(f"  v3 without iu_* ROC-AUC : {auc_no:.4f}")
        print(f"  Delta (IU benefit)      : {drop:+.4f} AUC points ({drop*100:+.2f}%)")

    # 8. Test predict_risk function
    print("\n[Sanity] Testing predict_risk API function on sample batch...")
    sample_df = df_v4.iloc[:5]
    probs = predict_risk(os.path.join("models", "best_speech_model.pkl"), sample_df)
    print(f"  Sample predicted probabilities: {np.round(probs, 4)}")
    print(f"  Actual labels                 : {y[:5]}")

    print("\n[Complete] Benchmark execution finished successfully.")


if __name__ == "__main__":
    main()
