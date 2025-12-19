import requests
import sys
import json
import base64
from datetime import datetime
import subprocess
import os

class MedReadAPITester:
    def __init__(self, base_url="https://mediscan-pro.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = None
        self.image_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}" if not endpoint.startswith('http') else endpoint
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.session_token and 'Authorization' not in test_headers:
            test_headers['Authorization'] = f'Bearer {self.session_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for multipart/form-data
                    test_headers.pop('Content-Type', None)
                    response = requests.post(url, files=files, data=data, headers=test_headers)
                else:
                    response = requests.post(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def create_test_user_and_session(self):
        """Create test user and session using MongoDB"""
        print("\n🔧 Creating test user and session...")
        
        timestamp = int(datetime.now().timestamp())
        user_id = f"test-user-{timestamp}"
        session_token = f"test_session_{timestamp}"
        
        # MongoDB command to create test user and session
        mongo_cmd = f"""
        use('test_database');
        var userId = '{user_id}';
        var sessionToken = '{session_token}';
        db.users.insertOne({{
          user_id: userId,
          email: 'test.user.{timestamp}@example.com',
          name: 'Test User {timestamp}',
          picture: 'https://via.placeholder.com/150',
          created_at: new Date()
        }});
        db.user_sessions.insertOne({{
          user_id: userId,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 7*24*60*60*1000),
          created_at: new Date()
        }});
        print('Session token: ' + sessionToken);
        print('User ID: ' + userId);
        """
        
        try:
            result = subprocess.run(['mongosh', '--eval', mongo_cmd], 
                                  capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                print(f"✅ Test user created successfully")
                print(f"   User ID: {user_id}")
                print(f"   Session Token: {session_token}")
                self.user_id = user_id
                self.session_token = session_token
                return True
            else:
                print(f"❌ Failed to create test user: {result.stderr}")
                return False
        except Exception as e:
            print(f"❌ Error creating test user: {str(e)}")
            return False

    def test_root_endpoint(self):
        """Test /api/ root endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_auth_me(self):
        """Test /api/auth/me endpoint"""
        success, response = self.run_test(
            "Auth Me Endpoint",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_image_upload(self):
        """Test /api/images/upload endpoint"""
        # Create a simple test image (1x1 pixel PNG)
        test_image_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==')
        
        files = {
            'file': ('test_image.png', test_image_data, 'image/png')
        }
        data = {
            'category': 'cancer'
        }
        
        success, response = self.run_test(
            "Image Upload",
            "POST",
            "images/upload",
            200,
            data=data,
            files=files
        )
        
        if success and 'image_id' in response:
            self.image_id = response['image_id']
            print(f"   Uploaded image ID: {self.image_id}")
        
        return success

    def test_get_images(self):
        """Test /api/images endpoint"""
        success, response = self.run_test(
            "Get Images",
            "GET",
            "images",
            200
        )
        return success

    def test_image_stats(self):
        """Test /api/images/stats endpoint"""
        success, response = self.run_test(
            "Image Stats",
            "GET",
            "images/stats",
            200
        )
        return success

    def test_start_session(self):
        """Test /api/sessions/start endpoint"""
        success, response = self.run_test(
            "Start Reading Session",
            "POST",
            "sessions/start",
            200,
            data={"image_count": 5}
        )
        
        if success and 'session' in response:
            self.session_id = response['session']['session_id']
            print(f"   Started session ID: {self.session_id}")
        
        return success

    def test_session_response(self):
        """Test /api/sessions/{id}/response endpoint"""
        if not self.session_id or not self.image_id:
            print("❌ Skipping session response test - no session or image ID")
            return False
            
        success, response = self.run_test(
            "Submit Session Response",
            "POST",
            f"sessions/{self.session_id}/response",
            200,
            data={
                "image_id": self.image_id,
                "diagnosis": "cancer",
                "time_taken_ms": 5000
            }
        )
        return success

    def test_pause_session(self):
        """Test /api/sessions/{id}/pause endpoint"""
        if not self.session_id:
            print("❌ Skipping pause test - no session ID")
            return False
            
        success, response = self.run_test(
            "Pause Session",
            "POST",
            f"sessions/{self.session_id}/pause",
            200
        )
        return success

    def test_resume_session(self):
        """Test /api/sessions/{id}/resume endpoint"""
        if not self.session_id:
            print("❌ Skipping resume test - no session ID")
            return False
            
        success, response = self.run_test(
            "Resume Session",
            "POST",
            f"sessions/{self.session_id}/resume",
            200
        )
        return success

    def test_complete_session(self):
        """Test /api/sessions/{id}/complete endpoint"""
        if not self.session_id:
            print("❌ Skipping complete test - no session ID")
            return False
            
        success, response = self.run_test(
            "Complete Session",
            "POST",
            f"sessions/{self.session_id}/complete",
            200
        )
        return success

    def test_session_csv(self):
        """Test /api/sessions/{id}/csv endpoint"""
        if not self.session_id:
            print("❌ Skipping CSV test - no session ID")
            return False
            
        success, response = self.run_test(
            "Get Session CSV",
            "GET",
            f"sessions/{self.session_id}/csv",
            200
        )
        return success

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        if self.user_id:
            mongo_cmd = f"""
            use('test_database');
            db.users.deleteMany({{user_id: '{self.user_id}'}});
            db.user_sessions.deleteMany({{user_id: '{self.user_id}'}});
            db.images.deleteMany({{user_id: '{self.user_id}'}});
            db.reading_sessions.deleteMany({{user_id: '{self.user_id}'}});
            db.session_responses.deleteMany({{session_id: '{self.session_id}'}});
            """
            
            try:
                subprocess.run(['mongosh', '--eval', mongo_cmd], 
                              capture_output=True, text=True, timeout=30)
                print("✅ Test data cleaned up")
            except Exception as e:
                print(f"⚠️  Warning: Could not clean up test data: {str(e)}")

def main():
    print("🚀 Starting MedRead API Tests")
    print("=" * 50)
    
    tester = MedReadAPITester()
    
    # Step 1: Test root endpoint (no auth required)
    if not tester.test_root_endpoint():
        print("❌ Root endpoint failed, stopping tests")
        return 1
    
    # Step 2: Create test user and session
    if not tester.create_test_user_and_session():
        print("❌ Failed to create test user, stopping tests")
        return 1
    
    # Step 3: Test authenticated endpoints
    tests = [
        tester.test_auth_me,
        tester.test_image_upload,
        tester.test_get_images,
        tester.test_image_stats,
        tester.test_start_session,
        tester.test_session_response,
        tester.test_pause_session,
        tester.test_resume_session,
        tester.test_complete_session,
        tester.test_session_csv
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
    
    # Cleanup
    tester.cleanup_test_data()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())