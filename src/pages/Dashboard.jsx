import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, LayoutDashboard, Briefcase, FileText, MessageSquare, BookOpen, Sparkles, Settings, 
  Award, Sun, Moon, Bell, Crown, Swords, ShieldCheck, ListChecks, Package, Share2, User,
  Lock, Eye, RefreshCw // 🆕 Added RefreshCw icon
} from 'lucide-react';

// --- LIBRARIES ---
import { toPng, toBlob } from 'html-to-image'; 

// --- SUPABASE & UTILS ---
import { supabase } from '../supabase';
import { QUIZZES, APP_STATUS } from '../utils/constants'; 

// UI Components
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
// Refactored Components
import DashboardSidebar from '../components/dashboard/DashboardSidebar'; 
import KycVerificationModal from '../components/modals/KycVerificationModal';
import ActiveQuizModal from '../components/modals/ActiveQuizModal';

// Features
import ChatSystem from '../components/features/ChatSystem';
import Overview from '../components/dashboard/Overview';
import Jobs from '../components/dashboard/Jobs';
import MyServices from '../components/dashboard/MyServices';
import ClientPostedJobs from '../components/dashboard/ClientPostedJobs';
import Applications from '../components/dashboard/Applications';
import Academy from '../components/dashboard/Academy';
import Portfolio from '../components/dashboard/Portfolio';
import ProfileCard from '../components/dashboard/ProfileCard';
import Records from '../components/dashboard/Records';
import SettingsComp from '../components/dashboard/SettingsComp';
import OrderTimeline from '../components/dashboard/OrderTimeline';

// Services
import * as api from '../services/dashboard.api';

// Modals
import PostJobModal from '../components/modals/PostJobModal';
import CreateServiceModal from '../components/modals/CreateServiceModal';
import ApplyJobModal from '../components/modals/ApplyJobModal';
import PaymentModal from '../components/modals/PaymentModal';

const Dashboard = ({ user, setUser, onLogout, showToast, darkMode, toggleTheme }) => {
  const isClient = user?.type === 'client';

  // --- UI & TAB STATES ---
  const [tab, setTab] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- DATA STATES ---
  const [jobs, setJobs] = useState([]);
  const [services, setServices] = useState([]);
  const [applications, setApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [referralStats, setReferralStats] = useState({ count: 0, earnings: 0 });
  const [totalEarnings, setTotalEarnings] = useState(0);

  // --- INTERACTION STATES ---
  const [showNotifications, setShowNotifications] = useState(false);
  const [modal, setModal] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null); 
  const [selectedApp, setSelectedApp] = useState(null);
  const [activeChat, setActiveChat] = useState(null); 
  const [energy, setEnergy] = useState(20); 

  // --- KYC STATE ---
  const [kycFile, setKycFile] = useState(null);

  // --- QUIZ & ACADEMY STATES ---
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);

  // --- HYBRID DELIVERY STATES ---
  const [timelineApp, setTimelineApp] = useState(null);
  const [viewWorkApp, setViewWorkApp] = useState(null);
  const lastNotificationId = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [profileForm, setProfileForm] = useState(user ? { ...user } : {});
  const [paymentModal, setPaymentModal] = useState(null);

  // --- FEATURE STATES ---
  const [parentMode, setParentMode] = useState(false);
  const [unlockedSkills, setUnlockedSkills] = useState(user?.unlockedSkills || []);
  const [badges, setBadges] = useState([]);
    
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [rawPortfolioText, setRawPortfolioText] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
    
  const SAFE_QUIZZES = QUIZZES || {};
  const profileCardRef = useRef(null);

  // --- CASHFREE REF ---
  const cashfree = useRef(null);

  // --- DERIVED VALUES ---
  const currentXP = unlockedSkills.length * 500 + (badges.length * 200);
  const nextLevelXP = (Math.floor(currentXP / 2000) + 1) * 2000;
  const progressPercent = Math.min((currentXP / nextLevelXP) * 100, 100);
  const userLevel = Math.floor(currentXP / 2000) + 1;

  const filteredJobs = jobs.filter(job => 
    (job.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (job.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (job.tags?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // --- CASHFREE INITIALIZATION ---
  useEffect(() => {
    if (window.Cashfree) {
      cashfree.current = new window.Cashfree({ mode: "sandbox" });
    }
  }, []);

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
// Replace the loadData function inside useEffect [cite: 28] with this:

const loadData = async () => {
    if (jobs.length === 0) setIsLoading(true);

    try {
        // 1. Create promises for all independent requests
        const energyPromise = !isClient ? api.getEnergy(user.id) : Promise.resolve({ energy: 0 });
        
        const badgesPromise = supabase
            .from('user_badges')
            .select('badge_name, badges(icon)')
            .eq('user_id', user.id);

        // Assuming api.fetchDashboardData handles jobs/services/etc internally
        // If possible, break that function apart too, but for now, parallelize what we can:
        const dashboardPromise = api.fetchDashboardData(user);

        // 2. Await all at once
        const [energyRes, badgeRes, dashboardRes] = await Promise.all([
            energyPromise,
            badgesPromise,
            dashboardPromise
        ]);

        // 3. Set State
        if (!isClient) setEnergy(energyRes.energy);

        const formattedBadges = badgeRes.data?.map(b => ({
            name: b.badge_name,
            icon: b.badges?.icon || 'Award'
        })) || [];
        setBadges(formattedBadges);

        const { services, jobs, applications, notifications, referralCount, error } = dashboardRes;

        if (!error) {
            setServices(services);
            setJobs(jobs);
            setApplications(applications);
            setNotifications(notifications);
            setReferralStats({ count: referralCount, earnings: referralCount * 50 });
            
            // Recalculate earnings synchronously
            const total = applications.reduce((acc, curr) => {
                 if (curr.status === 'Paid') {
                    const amount = Number(curr.bid_amount) || 0;
                    return isClient ? acc + amount : acc + (amount * 0.96);
                 }
                 return acc;
            }, 0);
            setTotalEarnings(total);
        }

    } catch (err) {
        showToast("Dashboard sync failed: " + err.message, "error");
    } finally {
        setIsLoading(false);
    }
};
    loadData();
    return () => { isMounted = false; };
  }, [user, isClient, showToast, jobs.length]);

  // --- ACTION HANDLERS ---
  const checkKycLock = (actionType) => {
    if (user.kyc_status === 'approved') return true;
    if (user.kyc_status === 'pending') {
       showToast("⏳ Your verification is under review. Please wait.", "info");
       return false;
    }
    const BLOCKED_ACTIONS = ['apply_paid', 'accept_job', 'release_escrow', 'post_job'];
    if (BLOCKED_ACTIONS.includes(actionType)) {
      setModal('kyc_verification'); 
      return false;
    }
    return true;
  };

  const handleKycSubmit = async (e) => {
    e.preventDefault();
    if (!kycFile) return showToast("Please select an ID file.", "error");
    showToast("Uploading secure documents...", "info");
    try {
        const fileName = `${user.id}/${Date.now()}_kyc`; 
        const { error: uploadError } = await supabase.storage
            .from('id_proofs')
            .upload(fileName, kycFile);
        if (uploadError) throw uploadError;
        const storedPath = fileName; 

        const table = isClient ? 'clients' : 'freelancers';
        const { error: dbError } = await supabase
            .from(table)
            .update({ 
                kyc_status: 'pending',
                id_proof_url: storedPath,
                kyc_submitted_at: new Date().toISOString()
            })
            .eq('id', user.id);
        if (dbError) throw dbError;
        showToast("KYC Submitted! An admin will review it shortly.", "success");
        setUser({ ...user, kyc_status: 'pending' }); 
        setModal(null); 
    } catch (err) {
        showToast("Verification failed: " + err.message, "error");
    }
  };

  const handlePostJob = async (e) => {
    e.preventDefault();
    if (!checkKycLock('post_job')) return;
    const formData = new FormData(e.target);
    const budget = parseFloat(formData.get('budget'));
    const title = formData.get('title');
    if (budget < 100) { showToast("Minimum budget is ₹100", "error"); return; }
    if (title.length < 5) { showToast("Job title is too short", "error"); return; }
    const jobData = { 
        client_id: user.id, client_name: user.name, title: title, budget: budget, 
        job_type: 'Fixed', duration: formData.get('duration'), tags: formData.get('tags'), 
        description: formData.get('description'), category: formData.get('category') || 'dev' 
    };
    const { error } = await api.createJob(jobData);
    if (error) { showToast(error.message, 'error'); } 
    else { showToast('Job Posted!'); setModal(null); setJobs([jobData, ...jobs]); }
  };

  const handleDeleteJob = async (id) => {
    if(!window.confirm("Are you sure you want to delete this job?")) return;
    const { error } = await api.deleteJob(id);
    if (error) { showToast(error.message, 'error'); } 
    else { showToast('Job Deleted'); setJobs(jobs.filter(j => j.id !== id)); }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const serviceData = {
      freelancer_id: user.id, freelancer_name: user.name, title: formData.get('title'),
      description: formData.get('description'), price: formData.get('price'),
      delivery_time: formData.get('delivery_time'), category: formData.get('category')
    };
    const { error } = await api.createService(serviceData);
    if (error) { showToast(error.message, 'error'); } 
    else { showToast('Gig Created Successfully!'); setModal(null); setServices([serviceData, ...services]); }
  };

  const handleDeleteService = async (id) => {
    if(!window.confirm("Delete this gig?")) return;
    const { error } = await api.deleteService(id);
    if (error) { showToast(error.message, 'error'); } 
    else { showToast('Service Deleted'); setServices(services.filter(s => s.id !== id)); }
  };

  const handleApplyJob = async (e, energyCost) => {
    e.preventDefault();
    if (parentMode) { showToast("Parent Mode Active", "error"); return; }
    if (!checkKycLock('apply_paid')) return;
    if (!isClient && selectedJob) {
      const jobCategory = selectedJob.category || 'dev';
      if (!unlockedSkills.includes(jobCategory)) {
        showToast(`Locked! Pass the ${jobCategory} quiz in Academy first.`, "error");
        setModal('quiz-locked');
        return;
      }
    }
    if (applications.some(app => app.job_id === selectedJob.id && app.freelancer_id === user.id)) { 
      showToast("Already applied!", "error");
      return; 
    }
    const { success, error: energyError } = await api.deductEnergy(user.id, energyCost);
    if (!success) {
        showToast(energyError.message, "error");
        return;
    }
    setEnergy(prev => prev - energyCost);
    const formData = new FormData(e.target);
    const appData = { 
      job_id: selectedJob.id, freelancer_id: user.id, freelancer_name: user.name, 
      client_id: selectedJob.client_id, cover_letter: formData.get('cover_letter'), 
      bid_amount: formData.get('bid_amount') 
    };
    const { error } = await api.applyForJob(appData, selectedJob.title);
    if (error) { showToast(error.message, 'error'); } 
    else { showToast('Applied successfully!'); setModal(null); }
  };

  const handleAcceptApplication = async (app) => {
    if (!checkKycLock('accept_job')) return;
    if (!cashfree.current) {
        showToast("Payment Gateway initializing... please wait.", "error");
        return;
    }
    showToast("Securing Payment Session...", "info");
    try {
      const { paymentSessionId, orderId, error } = await api.createEscrowSession(
        app.id, app.bid_amount, app.freelancer_id, user.phone 
      );
      if (error) throw new Error(error.message || "Secure Session Failed");
      if (!paymentSessionId) throw new Error("No session ID received.");
      cashfree.current.checkout({
          paymentSessionId: paymentSessionId,
          redirectTarget: "_modal",
      }).then(() => {
          setTimeout(() => handlePaymentVerification(orderId, app), 2000);
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handlePaymentVerification = async (orderId, app) => {
      showToast("Verifying Payment...", "info");
      const { success, error } = await api.verifyAndStartEscrow(orderId, app.id);
      if (success) {
         showToast("Payment Confirmed! Order Started.", "success");
         setApplications(prev => prev.map(a => 
            a.id === app.id ? { 
                ...a, status: 'Accepted', started_at: new Date().toISOString(), is_escrow_held: true 
            } : a
         ));
      } else {
         showToast("Payment verification failed. Please contact support.", "warning");
      }
  };

  // 🆕 PAYMENT RECOVERY HANDLER
  const handleVerifyPaymentStatus = async (appId, orderId) => {
     showToast("Checking Gateway Status...", "info");
     const { success, status, error } = await api.checkPaymentStatus(orderId);
     
     if (success && status === 'PAID') {
         // Auto-correct the database
         await api.verifyAndStartEscrow(orderId, appId);
         showToast("Payment Found! Order Started.", "success");
         setApplications(prev => prev.map(a => 
            a.id === appId ? { ...a, status: 'Accepted', started_at: new Date().toISOString() } : a
         ));
     } else {
         showToast("Payment still pending or failed at gateway.", "warning");
     }
  };

  const handleSubmitWork = async (e) => {
    e.preventDefault();
    if (!selectedApp) {
        showToast("Error: No active application selected.", "error");
        return;
    }
    setModal(null);
    showToast("Uploading work...", "info");
    const formData = new FormData(e.target);
    const workLink = formData.get('work_link');
    const message = formData.get('message');
    const files = e.target.files; 
    let uploadedUrls = [];
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('project-files').upload(filePath, file);
        if (!error) {
          const { data: publicUrl } = supabase.storage.from('project-files').getPublicUrl(filePath);
          uploadedUrls.push(publicUrl.publicUrl);
        }
      }
    }
    const timestamp = new Date().toISOString();
    const { error } = await supabase.functions.invoke('order-manager', {
      body: { 
        action: 'SUBMIT_WORK', appId: selectedApp.id, userId: user.id,
        payload: { work_link: workLink, message: message, files: uploadedUrls }
      }
    });

    if (error) {
      showToast("Submission failed: " + error.message, "error");
    } else {
      showToast("Work Submitted Successfully!", "success");
      setApplications(prev => prev.map(a => a.id === selectedApp.id ? { ...a, status: APP_STATUS.SUBMITTED, submitted_at: timestamp } : a));
      setSelectedApp(null); 
    }
  };

  const handleClearNotifications = async () => {
    try {
      const { error } = await api.clearUserNotifications(user.id);
      if (error) { showToast(error.message, 'error'); } 
      else { setNotifications([]); showToast("Notifications cleared", "success"); }
    } catch (err) { showToast("Failed to clear notifications: " + err.message, "error"); }
  };

  const handleApproveWork = async (app) => {
    const prevApps = [...applications];
    setApplications(apps => apps.map(a => a.id === app.id ? { ...a, status: APP_STATUS.COMPLETED } : a));
    const { error } = await supabase.functions.invoke('order-manager', {
      body: { action: 'APPROVE_WORK', appId: app.id, userId: user.id }
    });
    if (!error) {
      showToast("Work Approved! Please release payment.", "success");
      setViewWorkApp(null);
    } else {
      setApplications(prevApps); 
      showToast(error.message, 'error');
    }
  };

  const processPayment = async () => {
    if (!paymentModal) return;
    const { appId, amount, freelancerId } = paymentModal;
    const { error } = await api.processPayment(appId, amount, freelancerId);
    if (error) { showToast(error.message, 'error'); } 
    else { 
       showToast("Payment Successful!", "success");
       setApplications(apps => apps.map(a => a.id === appId ? { ...a, status: APP_STATUS.PAID, paid_at: new Date().toISOString() } : a));
       setPaymentModal(null);
       const paidApps = applications.filter(a => a.status === APP_STATUS.PAID);
       if (paidApps.length === 0) {
          showToast("🏆 BADGE UNLOCKED: First Gig!", "success");
          setBadges([...badges, { name: 'First Gig', icon: 'Briefcase' }]);
       }
    }
  };

  const handleAppAction = async (action, app) => {
    const RESTRICTED_ACTIONS = ['approve', 'pay', 'release_escrow'];
    if (parentMode && RESTRICTED_ACTIONS.includes(action)) {
        showToast("Parent Mode Active: Action Locked", "error");
        return;
    }
    if (action === 'accept') { handleAcceptApplication(app); return; }
    if (action === 'pay' && !checkKycLock('release_escrow')) { return; }
    if (action === 'submit') { setSelectedApp(app); setModal('submit_work'); return; }
    if (action === 'view_submission') { setViewWorkApp(app); return; }
    
    // 🆕 Add verification handler access
    if (action === 'verify_payment') {
         handleVerifyPaymentStatus(app.id, app.escrow_order_id);
         return;
    }
    
    const backendActionMap = { 'approve': 'APPROVE_WORK', 'pay': 'RELEASE_ESCROW', 'reject': 'REJECT_APPLICATION' };
    const backendAction = backendActionMap[action];
    if (backendAction) {
        showToast(`Processing ${action}...`, "info");
        const { error } = await supabase.functions.invoke('order-manager', {
            body: { action: backendAction, appId: app.id, userId: user.id }
        });
        if (error) {
             const errorBody = error.context?.json ? await error.context.json() : {};
             if (errorBody.isSecurityBlock) {
                 setParentMode(true); 
                 showToast("⛔ Security Block: Ask your parent to approve.", "error");
             } else {
                 showToast(error.message || "Action Failed", "error");
             }
        } else {
            const now = new Date().toISOString();
            setApplications(prev => prev.map(a => {
                if (a.id !== app.id) return a;
                if (action === 'approve') return { ...a, status: 'Completed', completed_at: now };
                if (action === 'pay') return { ...a, status: 'Paid', paid_at: now, is_escrow_held: false };
                return a;
            }));
            showToast("Action Successful!", "success");
            if (viewWorkApp) setViewWorkApp(null);
        }
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const tableName = isClient ? 'clients' : 'freelancers';

    // 1. BASE FIELDS (Safe for everyone)
    const cleanUpdates = { 
        name: profileForm.name, 
        phone: profileForm.phone, 
        nationality: profileForm.nationality 
    };

    if (!isClient) {
        // 2. FREELANCER PROFESSIONAL STATS
        cleanUpdates.age = profileForm.age; 
        cleanUpdates.qualification = profileForm.qualification;
        cleanUpdates.specialty = profileForm.specialty; 
        cleanUpdates.services = profileForm.services;

        // 3. LEGAL BANKING SPLIT (CRITICAL)
        // We calculate minor status dynamically based on the input age
        const isMinor = parseInt(profileForm.age) < 18;

        if (isMinor) {
            // --- OPTION A: MINOR (Save to Guardian Fields) ---
            cleanUpdates.guardian_name = profileForm.guardian_name;
            cleanUpdates.guardian_pan = profileForm.guardian_pan;
            cleanUpdates.guardian_upi = profileForm.guardian_upi;
            // Add guardian bank account fields here if your schema has them
            // cleanUpdates.guardian_account_number = profileForm.guardian_account_number;
        } else {
            // --- OPTION B: ADULT (Save to Personal Fields) ---
            cleanUpdates.upi = profileForm.upi; 
            cleanUpdates.bank_name = profileForm.bank_name;
            cleanUpdates.account_number = profileForm.account_number; 
            cleanUpdates.ifsc_code = profileForm.ifsc_code;
        }

    } else { 
        // 4. CLIENT SPECIFIC
        cleanUpdates.is_organisation = profileForm.is_organisation; 
    }

    // 5. SEND TO DB
    const { error } = await api.updateUserProfile(user.id, cleanUpdates, tableName);

    if (error) { 
        showToast(error.message, 'error'); 
    } else { 
        showToast("Profile & Bank Details updated!", "success"); 
        setUser({ ...user, ...cleanUpdates }); 
    }
  };

  const handleQuizSelection = async (categoryId, passed) => {
    if (passed) {
      setTimeout(async () => {
        const newSkills = [...unlockedSkills, categoryId];
        setUnlockedSkills(newSkills);
        await api.unlockSkill(user.id, newSkills); 
        setUser({ ...user, unlockedSkills: newSkills });
        await api.awardEnergy(user.id, 5); 
        setEnergy(prev => prev + 5);
        const hasBadge = badges.some(b => b.name === 'Skill Certified');
        if (!hasBadge) {
            const newBadge = { name: 'Skill Certified', icon: 'Award' };
            setBadges(prev => [...prev, newBadge]);
            await supabase.from('user_badges').insert({ user_id: user.id, badge_name: 'Skill Certified' });
        }
        showToast("🎉 Correct! +500 XP & +5 Energy ⚡", "success");
        setModal(null); setScore(0); setCurrentQuestionIndex(0);
      }, 1000);
    }
  };

  const handleAiGenerate = () => {
    if (!rawPortfolioText) return;
    setIsAiLoading(true);
    setTimeout(() => {
      const newItem = { id: Date.now(), title: "Professional Case Study", content: rawPortfolioText };
      setPortfolioItems([newItem, ...portfolioItems]);
      setRawPortfolioText("");
      setIsAiLoading(false);
      showToast("AI Magic Applied!");
    }, 1500);
  };

  const handleDownloadCard = async () => {
    if (profileCardRef.current === null) { showToast("Card not found.", "error"); return; }
    try {
      showToast("Generating HQ Image...", "info");
      const dataUrl = await toPng(profileCardRef.current, { cacheBust: true, pixelRatio: 3, backgroundColor: null });
      const link = document.createElement('a');
      link.download = `TeenVerse-${user.name || 'Profile'}.png`;
      link.href = dataUrl;
      link.click();
      showToast("Downloaded successfully!", "success");
    } catch (err) { showToast("Failed to download image: " + err.message, "error"); }
  };

  const handleShareToInstagram = async () => {
    if (profileCardRef.current === null) return;
    try {
      showToast("Preparing for Share...", "info");
      const blob = await toBlob(profileCardRef.current, { cacheBust: true, pixelRatio: 2 });
      if (!blob) throw new Error('Failed to generate image');
      const file = new File([blob], `TeenVerse-${user.name}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My TeenVerse Profile', text: `Check out my freelancer profile on TeenVerse! 🚀 #TeenVerse #Freelancer` });
        showToast("Shared successfully!", "success");
      } else {
        showToast("Sharing not supported on this device. Downloading instead.", "info");
        const link = document.createElement('a');
        link.download = `TeenVerse-${user.name}.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
      }
    } catch (err) { if (err.name !== 'AbortError') showToast("Failed to share: " + err.message, "error"); }
  };

  const getTabIcon = () => {
    const icons = {
      'overview': <LayoutDashboard size={20} className="text-indigo-600 dark:text-indigo-400"/>,
      'jobs': <Briefcase size={20} className="text-blue-500"/>,
      'posted-jobs': <ListChecks size={20} className="text-indigo-500"/>,
      'academy': <BookOpen size={20} className="text-emerald-500"/>,
      'battles': <Swords size={20} className="text-rose-500"/>,
      'settings': <Settings size={20} className="text-gray-500"/>,
      'profile-card': <User size={20} className="text-purple-500"/>,
      'pricing': <Crown size={20} className="text-yellow-500"/>,
      'records': <ShieldCheck size={20} className="text-blue-500"/>
    };
    return icons[tab] || <LayoutDashboard size={20} className="text-indigo-500"/>;
  };

  if (isLoading) {
    return (
        <div className="flex h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#020617]">
          <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="text-gray-500 text-sm animate-pulse">Loading TeenVerse...</p>
          </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#020617] transition-colors duration-500 font-sans overflow-hidden">
      
      {/* Background Gradient Mesh */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-40 dark:opacity-20">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-200 via-transparent to-transparent dark:from-indigo-900"></div>
         <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-200 via-transparent to-transparent dark:from-purple-900"></div>
      </div>

      <DashboardSidebar 
        user={user} isClient={isClient} badges={badges} userLevel={userLevel} progressPercent={progressPercent}
        menuOpen={menuOpen} setMenuOpen={setMenuOpen} zenMode={zenMode} setZenMode={setZenMode}
        tab={tab} setTab={setTab} onLogout={onLogout}
      />

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        
         {/* Header */}
         <header className="sticky top-0 z-30 px-6 py-4">
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-xl border border-gray-200/50 dark:border-white/5 rounded-2xl shadow-sm px-6 py-3 flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <button onClick={() => setMenuOpen(true)} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl"><Menu/></button>
                   <div className="flex items-center gap-3">
                    <div className="hidden sm:flex w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/5 items-center justify-center border border-gray-100 dark:border-white/5">{getTabIcon()}</div>
                      <div>
                         <h2 className="text-lg font-bold text-gray-900 dark:text-white capitalize leading-none">{tab.replace('-', ' ')}</h2>
                         <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">Welcome back, {user.name?.split(' ')[0]}</p>
                      </div>
                   </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-black/30 p-1 rounded-full">
                      <button onClick={() => !darkMode && toggleTheme()} className={`p-2 rounded-full transition-all ${!darkMode ? 'bg-white shadow-sm text-amber-500' : 'text-gray-400'}`}><Sun size={18}/></button>
                      <button onClick={() => darkMode && toggleTheme()} className={`p-2 rounded-full transition-all ${darkMode ? 'bg-gray-800 shadow-sm text-indigo-400' : 'text-gray-400'}`}><Moon size={18}/></button>
                  </div>
                  <div className="relative">
                    <button onClick={() => setShowNotifications(!showNotifications)} className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 text-gray-500 dark:text-gray-400 transition-colors">
                       <Bell size={20}/>
                      {notifications.length > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#0F172A]"></span>}
                    </button>
                    {showNotifications && (
                       <div className="absolute right-0 top-12 w-80 bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden animate-fade-in z-50">
                          <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                             <span className="font-bold text-sm dark:text-white">Notifications</span>
                             <button onClick={handleClearNotifications} className="text-xs font-medium text-indigo-500 hover:text-indigo-600">Clear All</button>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                           {notifications.length === 0 ? <div className="p-8 text-center text-gray-400 text-xs">No new alerts</div> : notifications.map(n => (
                               <div key={n.id} className="p-3 border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 text-xs text-gray-600 dark:text-gray-300 flex gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                                  {n.message}
                               </div>
                            ))}
                           </div>
                      </div>
                    )}
                  </div>
               </div>
            </div>
         </header>

         {/* Scrollable Content Area */}
         <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto">
               <div className="animate-fade-in-up">
                 {tab === 'overview' && (
                     <Overview user={user} isClient={isClient} totalEarnings={totalEarnings} jobsCount={isClient ? jobs.length : applications.length} badgesCount={badges.length} setTab={setTab} referralCount={referralStats.count} referralEarnings={referralStats.earnings} />
                 )}
                 {tab === 'jobs' && <Jobs isClient={isClient} services={services} filteredJobs={filteredJobs} searchTerm={searchTerm} setSearchTerm={setSearchTerm} setModal={setModal} setActiveChat={setActiveChat} setTab={setTab} setSelectedJob={setSelectedJob} parentMode={parentMode} />}
                 {tab === 'posted-jobs' && isClient && <ClientPostedJobs jobs={jobs} setModal={setModal} handleDeleteJob={handleDeleteJob} />}
                 
                 {tab === 'my-services' && !isClient && <MyServices services={services} setModal={setModal} handleDeleteService={handleDeleteService} />}
                 
                 {tab === 'applications' && (
                    <Applications 
                        applications={applications} 
                        isClient={isClient} 
                        parentMode={parentMode}
                        onAction={handleAppAction} 
                        onViewTimeline={(app) => setTimelineApp(app)}
                        showToast={showToast}
                    />
                 )}
                 
                 {tab === 'messages' && <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden h-[calc(100vh-180px)]"><ChatSystem user={user} activeChat={activeChat} setActiveChat={setActiveChat} parentMode={parentMode} /></div>}
                 {tab === 'academy' && !isClient && <Academy unlockedSkills={unlockedSkills} setModal={setModal} quizzes={SAFE_QUIZZES} />}
                 {tab === 'portfolio' && !isClient && <Portfolio rawPortfolioText={rawPortfolioText} setRawPortfolioText={setRawPortfolioText} handleAiGenerate={handleAiGenerate} isAiLoading={isAiLoading} portfolioItems={portfolioItems} />}
                 
                 {tab === 'profile-card' && !isClient && (
                   <ProfileCard 
                     ref={profileCardRef} 
                     user={user} 
                     unlockedSkills={unlockedSkills} 
                     badges={badges} 
                     userLevel={userLevel} 
                     applications={applications} 
                     handleDownloadCard={handleDownloadCard} 
                     handleShareToInstagram={handleShareToInstagram}
                     showToast={showToast} 
                   />
                 )}

                 {tab === 'records' && <Records applications={applications} />}
                 {tab === 'settings' && (
                  <SettingsComp 
                    profileForm={profileForm} 
                    setProfileForm={setProfileForm} 
                    isClient={isClient} 
                    handleUpdateProfile={handleUpdateProfile} 
                    parentMode={parentMode} 
                    setParentMode={setParentMode}
                    onOpenKyc={() => setModal('kyc_verification')} 
                  />
                )}
               </div>
            </div>
         </div>
      </main>

      {/* --- MODALS --- */}

      {modal === 'kyc_verification' && (
        <KycVerificationModal 
          user={user} 
          kycFile={kycFile} 
          setKycFile={setKycFile} 
          handleKycSubmit={handleKycSubmit} 
          onClose={() => setModal(null)} 
        />
      )}

      {modal === 'post-job' && <PostJobModal onClose={() => setModal(null)} onSubmit={handlePostJob} />}
      {modal === 'create-service' && <CreateServiceModal onClose={() => setModal(null)} onSubmit={handleCreateService} />}
      {modal === 'apply-job' && (
        <ApplyJobModal 
          onClose={() => setModal(null)} 
          onSubmit={handleApplyJob} 
          job={selectedJob} 
          user={user}
          currentEnergy={energy}
        />
      )}

      {timelineApp && (
        <Modal title={`Project Timeline: ${timelineApp.jobs?.title}`} onClose={() => setTimelineApp(null)}>
          <OrderTimeline application={timelineApp} />
          <div className="mt-4 text-center">
              <span className="text-xs bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-gray-500">Order ID: #{timelineApp.id}</span>
          </div>
        </Modal>
      )}

      {modal === 'submit_work' && (
        <Modal title="Deliver Your Work" onClose={() => setModal(null)}>
          <form onSubmit={handleSubmitWork} className="space-y-4">
             <div className="bg-indigo-50 p-4 rounded-xl text-indigo-800 text-sm mb-4"><strong>Instructions:</strong> Provide a link to your work (Drive/GitHub) OR upload files directly.</div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">External Link (Recommended)</label>
              <input name="work_link" type="url" placeholder="https://drive.google.com/..." className="w-full p-3 border rounded-xl dark:bg-black dark:border-gray-700 dark:text-white"/>
            </div>
             <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Message</label>
              <textarea name="message" rows="3" className="w-full p-3 border rounded-xl dark:bg-black dark:border-gray-700 dark:text-white" placeholder="Describe what you did..."></textarea>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Or Upload Files (Max 5MB)</label>
              <input type="file" name="files" multiple className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
            </div>
            <Button className="w-full py-3 shadow-lg shadow-indigo-500/20">Submit Delivery</Button>
          </form>
        </Modal>
      )}

      {viewWorkApp && (
        <Modal title="Review Delivery" onClose={() => setViewWorkApp(null)}>
          <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Freelancer Note</h4>
                <p className="text-gray-800 dark:text-gray-200 text-sm italic">"{viewWorkApp.work_message || 'No message provided'}"</p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase">Deliverables</h4>
                {viewWorkApp.work_link && (
                  <a href={viewWorkApp.work_link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 border border-indigo-100 rounded-xl hover:bg-indigo-50 transition-colors group">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600"><Package size={20}/></div>
                      <div className="flex-1"><p className="font-bold text-indigo-700 text-sm">External Project Link</p><p className="text-xs text-indigo-400 truncate">{viewWorkApp.work_link}</p></div>
                      <Eye size={16} className="text-gray-400 group-hover:text-indigo-600"/>
                   </a>
                )}
                {viewWorkApp.work_files && viewWorkApp.work_files.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600"><FileText size={20}/></div>
                      <div className="flex-1"><p className="font-bold text-gray-700 text-sm">Attached File {i+1}</p></div>
                      <Eye size={16} className="text-gray-400"/>
                  </a>
                ))}
             </div>

              <div className="pt-4 border-t border-gray-100 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setViewWorkApp(null)}>Close</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApproveWork(viewWorkApp)}>Approve Work</Button>
              </div>
          </div>
        </Modal>
      )}

      {modal === 'quiz-locked' && (
         <Modal title="Skill Locked" onClose={() => setModal(null)}>
            <div className="text-center py-8">
               <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400"><Lock size={40}/></div>
               <h3 className="text-xl font-bold dark:text-white mb-2">Access Denied</h3>
               <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto">You need to prove your skills in the Academy before applying to this category.</p>
               <Button onClick={() => {setModal(null); setTab('academy');}} className="w-full py-3">Go to Academy</Button>
            </div>
         </Modal>
      )}

      {modal?.type === 'quiz' && (
         <ActiveQuizModal 
           modalData={modal}
           currentQuestionIndex={currentQuestionIndex}
           score={score}
           setScore={setScore}
           setCurrentQuestionIndex={setCurrentQuestionIndex}
           handleQuizSelection={handleQuizSelection}
           onClose={() => setModal(null)}
           showToast={showToast}
         />
      )}

      {paymentModal && <PaymentModal onClose={() => setPaymentModal(null)} onConfirm={processPayment} paymentData={paymentModal} />}

    </div>
  );
};

export default Dashboard;
