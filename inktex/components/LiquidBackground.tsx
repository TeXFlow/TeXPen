import React from 'react';

const LiquidBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-[#fafafa] dark:bg-[#050505] transition-colors duration-500">
      {/* Deep ambient gradients */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white via-[#fafafa] to-slate-100 dark:from-[#0a0a1a] dark:via-[#050505] dark:to-[#1a0a1a] opacity-80 transition-colors duration-500" />
      
      {/* Animated Blobs - Colors adjusted for both themes */}
      <div className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] bg-cyan-300/30 dark:bg-cyan-500/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-blob" />
      <div className="absolute -bottom-[20%] -right-[10%] w-[50vw] h-[50vw] bg-purple-300/30 dark:bg-purple-500/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000" />
      <div className="absolute top-[40%] left-[40%] w-[40vw] h-[40vw] bg-pink-300/20 dark:bg-pink-500/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000" />

      {/* Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{
          backgroundImage: `linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
    </div>
  );
};

export default LiquidBackground;