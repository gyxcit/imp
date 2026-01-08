# multimodal_system.py
import threading
import queue
from analyzers.video_analyzer import VideoAnalyzer
from analyzers.audio_analyzer import AudioAnalyzer
from analyzers.emotion_fusion import EmotionFusion

class MultimodalSystem:
    def __init__(self, attention_detector):
        self.attention_detector = attention_detector
        
        self.video_analyzer = VideoAnalyzer()
        self.audio_analyzer = AudioAnalyzer()
        self.fusion_engine = EmotionFusion()
        
        self.video_queue = queue.Queue(maxsize=10)
        self.audio_queue = queue.Queue(maxsize=10)
        
        self.running = False
        self.threads = []
    
    def start(self):
        """Démarrer les threads d'analyse"""
        self.running = True
        
        video_thread = threading.Thread(target=self._process_video)
        audio_thread = threading.Thread(target=self._process_audio)
        fusion_thread = threading.Thread(target=self._process_fusion)
        
        self.threads = [video_thread, audio_thread, fusion_thread]
        
        for thread in self.threads:
            thread.start()
        
        print("🎥 Système multimodal démarré")
    
    def stop(self):
        """Arrêter proprement"""
        self.running = False
        for thread in self.threads:
            thread.join()
    
    def add_video_frame(self, frame):
        """Ajouter frame vidéo (appelé par WebSocket)"""
        if not self.video_queue.full():
            self.video_queue.put(frame)
    
    def add_audio_chunk(self, audio_data):
        """Ajouter chunk audio (appelé par WebSocket)"""
        if not self.audio_queue.full():
            self.audio_queue.put(audio_data)
    
    def _process_video(self):
        """Thread analyse vidéo"""
        while self.running:
            try:
                frame = self.video_queue.get(timeout=0.1)
                self.video_state = self.video_analyzer.analyze_frame(frame)
            except queue.Empty:
                continue
    
    def _process_audio(self):
        """Thread analyse audio"""
        while self.running:
            try:
                audio_chunk = self.audio_queue.get(timeout=0.1)
                self.audio_state = self.audio_analyzer.analyze_audio(audio_chunk)
            except queue.Empty:
                continue
    
    def _process_fusion(self):
        """Thread fusion + mise à jour attention"""
        while self.running:
            try:
                if hasattr(self, 'video_state') and hasattr(self, 'audio_state'):
                    unified = self.fusion_engine.fuse_signals(
                        self.video_state,
                        self.audio_state
                    )
                    
                    # Mettre à jour attention_detector existant
                    self._update_attention_system(unified)
                
                threading.Event().wait(1.0)  # 1 FPS fusion
            except Exception as e:
                print(f"❌ Erreur fusion: {e}")
    
    def _update_attention_system(self, unified_state):
        """Injecter dans attention_system existant"""
        # Mapper vers track_interaction
        if unified_state['pattern'] == 'absent':
            self.attention_detector.track_interaction('multimodal_absent')
        
        # Ajuster score directement (optionnel)
        multimodal_score = unified_state['attention_score']
        self.attention_detector.state['attention_score'] = int(
            (self.attention_detector.state['attention_score'] + multimodal_score) / 2
        )