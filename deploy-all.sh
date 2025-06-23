#!/bin/bash

# 🚀 AXEP Platform - Complete Deployment Script
# Deploys Web, Mobile, and Backend to production

echo -e "\n🚀 AXEP Platform - Production Deployment"
echo "======================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required CLI tools are installed
check_dependencies() {
    echo -e "\n${BLUE}🔍 Checking dependencies...${NC}"
    
    if ! command -v railway &> /dev/null; then
        echo -e "${RED}❌ Railway CLI not found. Install: npm install -g @railway/cli${NC}"
        exit 1
    fi
    
    if ! command -v vercel &> /dev/null; then
        echo -e "${RED}❌ Vercel CLI not found. Install: npm install -g vercel${NC}"
        exit 1
    fi
    
    if ! command -v eas &> /dev/null; then
        echo -e "${RED}❌ EAS CLI not found. Install: npm install -g eas-cli${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All dependencies found${NC}"
}

# Deploy Backend to Railway
deploy_backend() {
    echo -e "\n${BLUE}🚂 Deploying Backend to Railway...${NC}"
    cd web3-music-platform-new/backend
    
    # Build TypeScript
    npm run build
    
    # Deploy to Railway
    railway deploy
    
    echo -e "${GREEN}✅ Backend deployed to Railway${NC}"
    cd ../..
}

# Deploy Frontend to Vercel
deploy_frontend() {
    echo -e "\n${BLUE}▲ Deploying Frontend to Vercel...${NC}"
    cd web3-music-platform-new
    
    # Build the project
    npm run build
    
    # Deploy to Vercel
    vercel --prod
    
    echo -e "${GREEN}✅ Frontend deployed to Vercel${NC}"
    cd ..
}

# Build Mobile App with EAS
deploy_mobile() {
    echo -e "\n${BLUE}📱 Building Mobile App with EAS...${NC}"
    cd axep-mobile-app
    
    # Build for production
    eas build --platform all --profile production --non-interactive
    
    echo -e "${GREEN}✅ Mobile app built successfully${NC}"
    echo -e "${YELLOW}ℹ️  To submit to app stores, run:${NC}"
    echo -e "   ${YELLOW}eas submit --platform ios${NC}"
    echo -e "   ${YELLOW}eas submit --platform android${NC}"
    cd ..
}

# Main deployment flow
main() {
    echo -e "\n${YELLOW}Choose deployment option:${NC}"
    echo "1) Deploy All (Backend + Frontend + Mobile)"
    echo "2) Deploy Backend Only"
    echo "3) Deploy Frontend Only"
    echo "4) Build Mobile App Only"
    echo "5) Exit"
    
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1)
            check_dependencies
            deploy_backend
            deploy_frontend
            deploy_mobile
            echo -e "\n${GREEN}🎉 Full deployment completed!${NC}"
            ;;
        2)
            check_dependencies
            deploy_backend
            ;;
        3)
            check_dependencies
            deploy_frontend
            ;;
        4)
            check_dependencies
            deploy_mobile
            ;;
        5)
            echo -e "${YELLOW}Deployment cancelled${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice. Please run the script again.${NC}"
            exit 1
            ;;
    esac
    
    echo -e "\n${GREEN}✨ Deployment Summary:${NC}"
    echo -e "   🌐 Frontend: https://your-project.vercel.app"
    echo -e "   🚂 Backend: https://your-project.railway.app"
    echo -e "   📱 Mobile: Build completed (submit to stores manually)"
    echo -e "\n${BLUE}ℹ️  Don't forget to update environment variables with production URLs!${NC}"
}

# Run main function
main 