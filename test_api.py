import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from main import fastapi_app
from starlette.testclient import TestClient

client = TestClient(fastapi_app)

# Test 1: Register sample user
reg_payload = {
    'name': 'Sample Alice',
    'email': f'sample.alice.{os.getpid()}@test.com',
    'password': 'SecurePassword123!',
    'age': 72,
    'gender': 1,
    'educationLevel': 2,
    'ethnicity': 0,
    'lifestyle': {
        'Age': 72,
        'Gender': 1,
        'Ethnicity': 0,
        'EducationLevel': 2,
        'BMI': 28.5,
        'Smoking': 0,
        'AlcoholConsumption': 3.0,
        'PhysicalActivity': 4.5,
        'DietQuality': 7.0,
        'SleepQuality': 6.5,
        'FamilyHistoryAlzheimers': 1,
        'CardiovascularDisease': 0,
        'Diabetes': 0,
        'Depression': 0,
        'HeadInjury': 0,
        'Hypertension': 1,
        'SystolicBP': 130,
        'DiastolicBP': 85,
        'CholesterolTotal': 210.0
    },
    'healthDataConsent': True
}
res_reg = client.post('/auth/register', json=reg_payload)
print('Register status:', res_reg.status_code)
reg_data = res_reg.json()
print('Register user id:', reg_data.get('user', {}).get('id'))
token = reg_data.get('token')
headers = {'Authorization': f'Bearer {token}'}

# Test 2: Risk prediction
res_risk = client.get('/risk/lifestyle', headers=headers)
print('Risk status:', res_risk.status_code)
risk_json = res_risk.json()
print('Risk level:', risk_json.get('risk_level'))
print('Risk percentage:', risk_json.get('risk_percentage'))
print('Top 5 factors count:', len(risk_json.get('top_contributing_factors', [])))
for factor in risk_json.get('top_contributing_factors', []):
    print(f"  - {factor['label']}: value={factor['value']}, impact={factor['impact']}")

# Test 3: Update lifestyle and re-check risk
update_payload = {
    'lifestyle': {
        **reg_payload['lifestyle'],
        'Smoking': 1,
        'AlcoholConsumption': 15.0,
        'PhysicalActivity': 0.5,
        'Hypertension': 1
    },
    'healthDataConsent': True
}
res_up = client.put('/api/user/lifestyle', json=update_payload, headers=headers)
print('Update status:', res_up.status_code)

res_risk2 = client.get('/risk/lifestyle', headers=headers)
print('Refreshed risk percentage:', res_risk2.json().get('risk_percentage'))

# Test 4: Flask health route
res_health = client.get('/health')
print('Flask health status:', res_health.status_code)
print('Flask health resp:', res_health.json())
