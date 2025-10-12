from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="TaskFlow ML API",
    description="Machine Learning services for TaskFlow Employee Management System",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class Task(BaseModel):
    id: str
    title: str
    description: str
    priority: str
    assigneeId: str
    tags: List[str]
    status: str

class TaskRecommendationRequest(BaseModel):
    userId: str
    userSkills: List[str]
    userDepartment: str
    availableTasks: List[Task]
    completedTasks: List[Task]

class TaskRecommendation(BaseModel):
    taskId: str
    title: str
    score: float
    reason: str

class ResourceRecommendationRequest(BaseModel):
    userId: str
    currentTasks: List[Task]
    teamMembers: List[dict]

class ResourceRecommendation(BaseModel):
    type: str  # 'colleague', 'training', 'tool'
    name: str
    reason: str
    priority: str

# ML Models and utilities
class TaskRecommendationEngine:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
        self.is_trained = False
        
    def train(self, tasks: List[Task]):
        """Train the recommendation model with historical tasks"""
        if not tasks:
            return
            
        # Combine task title and description for text analysis
        task_texts = [f"{task.title} {task.description} {' '.join(task.tags)}" for task in tasks]
        
        try:
            self.task_vectors = self.vectorizer.fit_transform(task_texts)
            self.tasks = tasks
            self.is_trained = True
            logger.info(f"Model trained with {len(tasks)} tasks")
        except Exception as e:
            logger.error(f"Error training model: {str(e)}")
    
    def recommend_tasks(self, user_profile: dict, available_tasks: List[Task], top_k: int = 5) -> List[TaskRecommendation]:
        """Recommend tasks based on user profile and available tasks"""
        if not available_tasks:
            return []
            
        recommendations = []
        
        # Simple rule-based recommendations for demo
        for task in available_tasks[:top_k]:
            score = self._calculate_task_score(user_profile, task)
            reason = self._generate_recommendation_reason(user_profile, task, score)
            
            recommendations.append(TaskRecommendation(
                taskId=task.id,
                title=task.title,
                score=score,
                reason=reason
            ))
        
        # Sort by score descending
        recommendations.sort(key=lambda x: x.score, reverse=True)
        return recommendations[:top_k]
    
    def _calculate_task_score(self, user_profile: dict, task: Task) -> float:
        """Calculate task recommendation score"""
        score = 0.5  # Base score
        
        # Skill matching
        user_skills = set(skill.lower() for skill in user_profile.get('userSkills', []))
        task_tags = set(tag.lower() for tag in task.tags)
        skill_overlap = len(user_skills.intersection(task_tags))
        score += skill_overlap * 0.2
        
        # Priority adjustment
        priority_scores = {'high': 0.3, 'medium': 0.2, 'low': 0.1}
        score += priority_scores.get(task.priority.lower(), 0.1)
        
        # Random factor for diversity
        score += np.random.uniform(0, 0.1)
        
        return min(score, 1.0)
    
    def _generate_recommendation_reason(self, user_profile: dict, task: Task, score: float) -> str:
        """Generate explanation for recommendation"""
        reasons = []
        
        user_skills = set(skill.lower() for skill in user_profile.get('userSkills', []))
        task_tags = set(tag.lower() for tag in task.tags)
        
        if user_skills.intersection(task_tags):
            reasons.append("matches your skills")
        
        if task.priority.lower() == 'high':
            reasons.append("high priority task")
        
        if score > 0.8:
            reasons.append("excellent fit for your profile")
        elif score > 0.6:
            reasons.append("good match for your experience")
        else:
            reasons.append("opportunity to learn new skills")
        
        return "Recommended because it " + " and ".join(reasons) + "."

class ResourceRecommendationEngine:
    def recommend_resources(self, request: ResourceRecommendationRequest) -> List[ResourceRecommendation]:
        """Recommend resources based on current tasks and team"""
        recommendations = []
        
        # Analyze current tasks for potential help needed
        for task in request.currentTasks:
            if task.priority.lower() == 'high':
                # Recommend colleague collaboration
                if request.teamMembers:
                    colleague = np.random.choice(request.teamMembers)
                    recommendations.append(ResourceRecommendation(
                        type="colleague",
                        name=colleague.get('name', 'Team Member'),
                        reason=f"Collaborate on high-priority task: {task.title}",
                        priority="high"
                    ))
            
            # Recommend training based on task tags
            for tag in task.tags:
                if tag.lower() in ['python', 'javascript', 'react', 'aws']:
                    recommendations.append(ResourceRecommendation(
                        type="training",
                        name=f"Advanced {tag} Training",
                        reason=f"Enhance skills for better performance on {task.title}",
                        priority="medium"
                    ))
                    break  # Only one training recommendation per task
        
        # Recommend productivity tools
        if len(request.currentTasks) > 3:
            recommendations.append(ResourceRecommendation(
                type="tool",
                name="Project Management Tool",
                reason="Manage multiple tasks more efficiently",
                priority="medium"
            ))
        
        return recommendations[:5]  # Limit to top 5 recommendations

# Initialize ML engines
task_recommender = TaskRecommendationEngine()
resource_recommender = ResourceRecommendationEngine()

@app.get("/")
async def root():
    return {"message": "TaskFlow ML API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_trained": task_recommender.is_trained}

@app.post("/recommendations/tasks", response_model=List[TaskRecommendation])
async def get_task_recommendations(request: TaskRecommendationRequest):
    """Get task recommendations for a user"""
    try:
        # Train model with completed tasks if not already trained
        if not task_recommender.is_trained and request.completedTasks:
            task_recommender.train(request.completedTasks)
        
        user_profile = {
            'userId': request.userId,
            'userSkills': request.userSkills,
            'userDepartment': request.userDepartment
        }
        
        recommendations = task_recommender.recommend_tasks(
            user_profile,
            request.availableTasks,
            top_k=5
        )
        
        logger.info(f"Generated {len(recommendations)} task recommendations for user {request.userId}")
        return recommendations
        
    except Exception as e:
        logger.error(f"Error generating task recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate task recommendations")

@app.post("/recommendations/resources", response_model=List[ResourceRecommendation])
async def get_resource_recommendations(request: ResourceRecommendationRequest):
    """Get resource recommendations for a user"""
    try:
        recommendations = resource_recommender.recommend_resources(request)
        logger.info(f"Generated {len(recommendations)} resource recommendations for user {request.userId}")
        return recommendations
        
    except Exception as e:
        logger.error(f"Error generating resource recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate resource recommendations")

@app.post("/train")
async def train_model(tasks: List[Task]):
    """Train the recommendation model with new task data"""
    try:
        task_recommender.train(tasks)
        return {"message": f"Model trained successfully with {len(tasks)} tasks"}
    except Exception as e:
        logger.error(f"Error training model: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to train model")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
