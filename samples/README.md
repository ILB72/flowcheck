# 예시 CSV 출처

이 폴더의 CSV 2개는 FlowCheck를 위해 **합성**한 분류 결과 라벨 목록입니다(헤더 `predicted`, 한 줄에 클래스명 하나). 두 파일 모두 합성 예시이며, `sample_no_skew.csv`(쏠림 없는 예시)는 논문 값이 아닌 임의 예시입니다.

- `sample_paper_pc.csv`: 논문 표의 PC 트래픽 697 Flow 분류 건수(BelkinCamera 392, AmazonEcho 186, SamsungSmartThings 100, NetatmoWeatherStation 18, TPLinkSmartPlug 1)를 라벨 목록으로 풀어 쓴 것. 행 순서는 섞었습니다.
- `sample_no_skew.csv`: 5개 클래스 20건씩 100행. 한쪽 쏠림이 없는 경우를 보여 주려는 임의 예시.

UNSW-IoTraffic 원자료, 실제 트래픽, 식별자(IP·MAC 등)는 포함하지 않습니다.
