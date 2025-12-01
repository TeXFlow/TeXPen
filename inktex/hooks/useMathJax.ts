import { useEffect } from 'react';

export const useMathJax = (content: any, containerId?: string, containerClass?: string) => {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
      // Use a small timeout or requestAnimationFrame to ensure DOM is ready
      const updateMath = () => {
          let nodes: Element[] = [];
          
          if (containerId) {
             const el = document.getElementById(containerId);
             if (el) nodes.push(el);
          }
          
          if (containerClass) {
              const els = document.querySelectorAll(`.${containerClass}`);
              nodes = [...nodes, ...Array.from(els)];
          }
          
          if (nodes.length > 0) {
              // Clear previous content rendering artifacts if necessary, then typeset
              window.MathJax.typesetPromise(nodes).catch((err: any) => console.log('MathJax Error:', err));
          }
      };

      // MathJax operations should be queued slightly after render
      requestAnimationFrame(updateMath);
    }
  }, [content, containerId, containerClass]);
};